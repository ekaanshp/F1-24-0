#!/usr/bin/env python3
# =============================================================================
# compute_ratings.py — F1 TeamBuilder Rating Pipeline
# =============================================================================
# Computes per-season and career-aggregated ratings for:
#   - Drivers
#   - Constructors (Chassis)
#   - Engine Manufacturers
#   - Team Principals
#   - Chief Engineers
#   - Car Designers
#
# Implements the formulas defined in formula.txt with:
#   - Rate-based metrics (never raw totals)
#   - Era-relative Z-score normalization
#   - Percentile mapping via Φ (CDF of standard normal)
#   - Weighted sub-attribute composites
#   - Peak-weighted recency decay career aggregation
# =============================================================================

import math
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / '.env.local')

DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    raise RuntimeError('DATABASE_URL not found in .env.local')

engine = create_engine(DB_URL)

# Career aggregation parameters (formula.txt Section 1, Step 5)
CAREER_DECAY_ALPHA = 0.92       # Each year further from latest is weighted 8% less
CAREER_PEAK_BONUS = 1.3         # Top peak seasons get 30% extra weight
CAREER_PEAK_COUNT = 2           # Number of top seasons that receive the peak bonus

# Races per season (formula.txt Section 7A)
RACES_PER_YEAR = {
    1950: 7, 1951: 8, 1952: 8, 1953: 9, 1954: 9, 1955: 7, 1956: 8, 1957: 8, 1958: 11,
    1959: 9, 1960: 10, 1961: 8, 1962: 9, 1963: 10, 1964: 10, 1965: 10, 1966: 9,
    1967: 11, 1968: 12, 1969: 11, 1970: 13, 1971: 11, 1972: 12, 1973: 15, 1974: 15,
    1975: 14, 1976: 16, 1977: 17, 1978: 16, 1979: 15, 1980: 14, 1981: 15, 1982: 16,
    1983: 15, 1984: 16, 1985: 16, 1986: 16, 1987: 16, 1988: 16, 1989: 16, 1990: 16,
    1991: 16, 1992: 16, 1993: 16, 1994: 16, 1995: 17, 1996: 16, 1997: 17, 1998: 16,
    1999: 16, 2000: 17, 2001: 17, 2002: 17, 2003: 16, 2004: 18, 2005: 19, 2006: 18,
    2007: 17, 2008: 18, 2009: 17, 2010: 19, 2011: 19, 2012: 20, 2013: 19, 2014: 19,
    2015: 19, 2016: 21, 2017: 20, 2018: 21, 2019: 21, 2020: 17, 2021: 22, 2022: 22,
    2023: 22, 2024: 24, 2025: 24,
}


# ---------------------------------------------------------------------------
# Utility Functions
# ---------------------------------------------------------------------------

def clamp(value: float, minimum: float = 30.0, maximum: float = 99.0) -> float:
    """Clamp a value to [minimum, maximum]. Default: [30, 99]."""
    return float(max(minimum, min(maximum, value)))


def normal_cdf(z: pd.Series | float) -> pd.Series | float:
    """Compute the CDF of the standard normal distribution: Φ(z)."""
    if isinstance(z, pd.Series):
        return 0.5 * (1.0 + z.apply(lambda x: math.erf(x / math.sqrt(2))))
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2)))


def z_score(series: pd.Series) -> pd.Series:
    """Compute Z-scores for a series. Returns 0 if σ=0 (all identical)."""
    std = series.std(ddof=0)
    if std == 0 or math.isnan(std):
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def get_race_count(year: int) -> int:
    """Return the number of races for a given season."""
    return RACES_PER_YEAR.get(year, 24)


def max_win_points(year: int) -> int:
    """Return the maximum points awarded for a race win in the given year.
    Formula.txt Section 7B."""
    if year <= 1960:
        return 8
    if year <= 1990:
        return 9
    if year <= 2009:
        return 10
    return 25


def second_place_points(year: int) -> int:
    """Return the points awarded for second place in the given year.
    Formula.txt Section 7B."""
    if year <= 1960:
        return 6
    if year <= 1990:
        return 6
    if year <= 2002:
        return 6
    if year <= 2009:
        return 8
    return 18


def write_back_source_table(df: pd.DataFrame, table_name: str, columns: list[str]):
    """Truncate a source table and write back enriched data, preserving schema.

    Uses TRUNCATE ... RESTART IDENTITY to clear rows while keeping the
    table structure (indexes, constraints, sequences) intact, then appends
    the enriched DataFrame.
    """
    write_df = df[columns].copy()
    with engine.connect() as conn:
        conn.execute(text(f'TRUNCATE TABLE {table_name} RESTART IDENTITY'))
        conn.commit()
    write_df.to_sql(table_name, engine, if_exists='append', index=False)
    print(f'  \u2713 Wrote {len(write_df)} enriched rows back to {table_name}')


# ---------------------------------------------------------------------------
# Data Loading
# ---------------------------------------------------------------------------

def load_table(table_name: str) -> pd.DataFrame:
    """Load an entire table from the database."""
    with engine.connect() as conn:
        return pd.read_sql(text(f'SELECT * FROM {table_name}'), conn)


def load_year_counts() -> pd.DataFrame:
    """Load per-year counts of distinct drivers N(Y) and constructors T(Y)."""
    with engine.connect() as conn:
        drivers = pd.read_sql(
            text('SELECT year, COUNT(DISTINCT driver_id) AS n_drivers FROM driver_seasons GROUP BY year'),
            conn,
        )
        constructors = pd.read_sql(
            text('SELECT year, COUNT(DISTINCT constructor_id) AS n_constructors FROM constructor_seasons GROUP BY year'),
            conn,
        )
    return (
        drivers.merge(constructors, on='year', how='outer')
        .fillna(0)
        .astype({'year': int, 'n_drivers': int, 'n_constructors': int})
    )


def map_year_metadata(df: pd.DataFrame) -> pd.DataFrame:
    """Add race_count, max_win_points, max_constructor_points, max_points_available columns."""
    df = df.copy()
    df['year'] = df['year'].astype(int)
    df['race_count'] = df['year'].map(get_race_count)
    df['max_win_points'] = df['year'].map(max_win_points)
    df['max_constructor_points'] = (df['max_win_points'] + df['year'].map(second_place_points)) * df['race_count']
    df['max_points_available'] = df['max_win_points'] * df['race_count']
    return df


# ---------------------------------------------------------------------------
# Career Aggregation (formula.txt Section 1, Step 5)
# ---------------------------------------------------------------------------

def compute_career_overall(season_df: pd.DataFrame, entity_col: str) -> pd.DataFrame:
    """Compute career overall ratings using peak-weighted recency decay.

    For each entity, the career overall is:
        career_overall = Σ [w(Y) × season_overall(Y)] / Σ w(Y)

    where:
        w(Y) = α^(Y_latest - Y) × peak_bonus(Y)
        α = 0.92  (8% decay per year from latest season)
        peak_bonus = 1.3 for top 2 seasons, 1.0 otherwise
    """
    results = []

    for entity_name, group in season_df.groupby(entity_col):
        group = group.sort_values('year')
        y_latest = group['year'].max()

        # Identify peak seasons (top CAREER_PEAK_COUNT by season_overall)
        peak_threshold = group['season_overall'].nlargest(CAREER_PEAK_COUNT).min()
        is_peak = group['season_overall'] >= peak_threshold

        # Compute weights
        recency_weight = CAREER_DECAY_ALPHA ** (y_latest - group['year'])
        peak_bonus = is_peak.map({True: CAREER_PEAK_BONUS, False: 1.0})
        weights = recency_weight * peak_bonus

        # Weighted average
        career_ovr = clamp((weights * group['season_overall']).sum() / weights.sum())

        results.append({
            entity_col: entity_name,
            'career_overall': career_ovr,
            'seasons_count': len(group),
            'peak_season_overall': group['season_overall'].max(),
            'latest_year': y_latest,
        })

    return pd.DataFrame(results)


def compute_decade_overall(season_df: pd.DataFrame, entity_col: str) -> pd.DataFrame:
    """Compute decade-by-decade ratings.

    For each entity and decade, the rating is the average of season overalls
    during that decade.
    """
    df = season_df.copy()
    df['decade'] = (df['year'] // 10 * 10).astype(int).astype(str) + 's'

    results = []
    for (entity_name, decade), group in df.groupby([entity_col, 'decade']):
        results.append({
            entity_col: entity_name,
            'decade': decade,
            'rating': clamp(group['season_overall'].mean()),
            'seasons_count': len(group),
            'peak_season_overall': group['season_overall'].max(),
            'latest_year': int(group['year'].max()),
        })

    return pd.DataFrame(results)


# ---------------------------------------------------------------------------
# Driver Ratings (formula.txt Section 2)
# ---------------------------------------------------------------------------

def build_driver_season_ratings(driver_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    """Compute per-season driver ratings using teammate comparison and baseline replacement model.

    DRIVER OVERALL = 0.30 × DOMINANCE
                   + 0.25 × RACE_CRAFT
                   + 0.20 × QUALIFYING_PROWESS
                   + 0.15 × CONSISTENCY
                   + 0.10 × CHAMPIONSHIP_PEDIGREE
    """
    df = driver_df[['driver_id', 'driver_name', 'year', 'position', 'points',
                     'race_wins', 'pole_positions', 'constructors']].copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts.drop(columns=['n_constructors'], errors='ignore'), on='year', how='left')
    df['n_drivers'] = df['n_drivers'].replace(0, 1)

    # --- Sub-attribute 1: DOMINANCE (0.30) ---
    # dom_rate = sqrt(win_rate × points_rate) — geometric mean
    df['win_rate'] = df['race_wins'].fillna(0) / df['race_count']
    df['points_rate'] = df['points'].fillna(0) / df['max_points_available']
    df['dominance_rate'] = (df['win_rate'] * df['points_rate']).pow(0.5)

    # --- Sub-attribute 2: RACE_CRAFT (0.25) ---
    # PAWE = 0.6 × win_rate + 0.4 × normalized_position
    df['normalized_position'] = df.apply(
        lambda row: 1.0 if row['n_drivers'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_drivers'] - 1)),
        axis=1,
    )
    df['PAWE'] = 0.6 * df['win_rate'] + 0.4 * df['normalized_position']

    # --- Sub-attribute 3: QUALIFYING_PROWESS (0.20) ---
    df['pole_rate'] = df['pole_positions'].fillna(0) / df['race_count']

    # --- Sub-attribute 4: CONSISTENCY (0.15) ---
    # consistency_raw = points_harvest_rate / max(points_harvest_rate in year)
    df['points_harvest_rate'] = df['points'].fillna(0) / df['max_points_available']
    df['consistency_raw'] = df['points_harvest_rate'] / df.groupby('year')['points_harvest_rate'].transform('max').replace(0, 1)

    # --- Sub-attribute 5: CHAMPIONSHIP_PEDIGREE (0.10) ---
    df['champ_percentile'] = df.apply(
        lambda row: 1.0 if row['n_drivers'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_drivers'] - 1)),
        axis=1,
    )

    # --- Compute raw Z-scores before teammate adjustments ---
    df['dominance_score_raw'] = df.groupby('year')['dominance_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['race_craft_score_raw'] = df.groupby('year')['PAWE'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['qualifying_score_raw'] = df.groupby('year')['pole_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['consistency_score_raw'] = df.groupby('year')['consistency_raw'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['championship_score_raw'] = (df['champ_percentile'] * 100).clip(30, 99)
    df['season_overall_raw'] = (
        0.30 * df['dominance_score_raw']
        + 0.25 * df['race_craft_score_raw']
        + 0.20 * df['qualifying_score_raw']
        + 0.15 * df['consistency_score_raw']
        + 0.10 * df['championship_score_raw']
    ).apply(clamp)

    # --- Extract teammates and team stats to compute car standings and comparison ---
    df['constructor_list'] = df['constructors'].fillna('').apply(lambda s: [c.strip() for c in s.split(',') if c.strip()])

    flat_rows = []
    for idx, row in df.iterrows():
        for c in row['constructor_list']:
            flat_rows.append({
                'driver_id': row['driver_id'],
                'year': int(row['year']),
                'points': float(row['points'] or 0.0),
                'race_wins': int(row['race_wins'] or 0),
                'pole_positions': int(row['pole_positions'] or 0),
                'position': int(row['position']),
                'constructor': c
            })

    df_flat = pd.DataFrame(flat_rows)

    const_year_groups = df_flat.groupby(['year', 'constructor'])
    const_stats = const_year_groups.agg(
        const_points=('points', 'sum'),
        const_wins=('race_wins', 'sum'),
        const_poles=('pole_positions', 'sum'),
        const_drivers=('driver_id', 'nunique')
    ).reset_index()

    const_stats['const_rank'] = const_stats.groupby('year')['const_points'].rank(ascending=False, method='min')
    const_counts = const_stats.groupby('year')['constructor'].nunique().rename('n_constructors').reset_index()
    const_stats = const_stats.merge(const_counts, on='year', how='left')

    teammate_rows = []
    for idx, row in df_flat.iterrows():
        t_mask = (df_flat['year'] == row['year']) & (df_flat['constructor'] == row['constructor']) & (df_flat['driver_id'] != row['driver_id'])
        teammates = df_flat[t_mask]
        
        if not teammates.empty:
            t_points = teammates['points'].mean()
            t_wins = teammates['race_wins'].mean()
            t_poles = teammates['pole_positions'].mean()
            t_pos = teammates['position'].mean()
            has_teammate = True
        else:
            t_points = 0.0
            t_wins = 0.0
            t_poles = 0.0
            t_pos = row['position']
            has_teammate = False
            
        teammate_rows.append({
            'driver_id': row['driver_id'],
            'year': row['year'],
            'constructor': row['constructor'],
            'has_teammate': has_teammate,
            'teammate_avg_points': t_points,
            'teammate_avg_wins': t_wins,
            'teammate_avg_poles': t_poles,
            'teammate_avg_pos': t_pos
        })

    df_teammates = pd.DataFrame(teammate_rows)
    df_flat = df_flat.merge(df_teammates, on=['driver_id', 'year', 'constructor'], how='left')
    df_flat = df_flat.merge(const_stats[['year', 'constructor', 'const_rank', 'n_constructors']], on=['year', 'constructor'], how='left')

    driver_season_adjs = df_flat.groupby(['driver_id', 'year']).agg(
        const_rank=('const_rank', 'mean'),
        n_constructors=('n_constructors', 'first'),
        has_teammate=('has_teammate', 'any'),
        teammate_avg_points=('teammate_avg_points', 'mean'),
        teammate_avg_wins=('teammate_avg_wins', 'mean'),
        teammate_avg_poles=('teammate_avg_poles', 'mean'),
        teammate_avg_pos=('teammate_avg_pos', 'mean')
    ).reset_index()

    df = df.merge(driver_season_adjs, on=['driver_id', 'year'], how='left')

    # --- Apply Baseline Replacement Model (Model D) ---
    def apply_baseline_replacement(row):
        if not row['has_teammate']:
            return pd.Series([
                row['dominance_score_raw'],
                row['race_craft_score_raw'],
                row['qualifying_score_raw'],
                row['consistency_score_raw'],
                row['championship_score_raw'],
                row['season_overall_raw']
            ])
        
        # Car Quality Index (CQI)
        n_const = row['n_constructors'] if pd.notna(row['n_constructors']) and row['n_constructors'] > 1 else 10
        rank = row['const_rank'] if pd.notna(row['const_rank']) else 5
        cqi = 1.0 - (rank - 1) / n_const
        cqi = max(0.0, min(1.0, cqi))
        
        # Teammate comparison factor
        pos_diff = row['teammate_avg_pos'] - row['position']
        n_drv = row['n_drivers'] if pd.notna(row['n_drivers']) and row['n_drivers'] > 1 else 20
        pos_diff_score = pos_diff / n_drv
        
        d_pts = row['points'] or 0.0
        t_pts = row['teammate_avg_points'] or 0.0
        
        d_wins = row['race_wins'] or 0.0
        t_wins = row['teammate_avg_wins'] or 0.0
        d_poles = row['pole_positions'] or 0.0
        t_poles = row['teammate_avg_poles'] or 0.0
        
        w_pos_raw = 0.5
        w_pts_raw = 0.3
        w_wins_raw = 0.1
        w_poles_raw = 0.1
        
        # Scale points weight based on team points using exponential decay
        p_team = d_pts + t_pts
        if p_team > 0:
            theta = 1.0 - math.exp(-p_team / 15.0)
            w_pts_raw = 0.3 * theta
            w_pos_raw = 0.5 + 0.3 * (1.0 - theta)
        else:
            w_pts_raw = 0.0
            w_pos_raw = 0.8
            
        if d_wins + t_wins == 0:
            w_wins_raw = 0.0
            w_pos_raw += 0.05
            w_pts_raw += 0.05
            
        if d_poles + t_poles == 0:
            w_poles_raw = 0.0
            w_pos_raw += 0.05
            w_pts_raw += 0.05
            
        w_sum = w_pos_raw + w_pts_raw + w_wins_raw + w_poles_raw
        w_pos = w_pos_raw / w_sum
        w_pts = w_pts_raw / w_sum
        w_wins = w_wins_raw / w_sum
        w_poles = w_poles_raw / w_sum
        
        pts_diff_score = (d_pts / (d_pts + t_pts) - 0.5) if d_pts + t_pts > 0 else 0.0
        wins_diff_score = (d_wins / (d_wins + t_wins) - 0.5) if d_wins + t_wins > 0 else 0.0
        poles_diff_score = (d_poles / (d_poles + t_poles) - 0.5) if d_poles + t_poles > 0 else 0.0
        
        teammate_diff = w_pos * pos_diff_score + w_pts * pts_diff_score + w_wins * wins_diff_score + w_poles * poles_diff_score
        teammate_factor = teammate_diff * 2.0  # scale to [-1.0, 1.0] range
        
        adj_scores = {}
        sub_attrs = ['dominance_score_raw', 'race_craft_score_raw', 'qualifying_score_raw', 'consistency_score_raw']
        
        for attr in sub_attrs:
            val = row[attr]
            if teammate_factor > 0:
                # Beat teammate: baseline maps teammate_factor from 0.0 to 1.0 -> 55.0 to 90.0
                baseline = 55.0 + 35.0 * teammate_factor
                # Boost if car is poor
                baseline = baseline + 10.0 * (1.0 - cqi)
                adj_val = max(val, baseline)
            else:
                # Lost to teammate: apply car-quality penalty
                penalty = 20.0 * abs(teammate_factor) * cqi
                adj_val = max(30.0, val - penalty)
            adj_scores[attr] = adj_val
            
        # Championship score
        val_champ = row['championship_score_raw']
        if teammate_factor > 0:
            adj_scores['championship_score'] = max(val_champ, 55.0 + 35.0 * teammate_factor)
        else:
            penalty = 20.0 * abs(teammate_factor) * cqi
            adj_scores['championship_score'] = max(30.0, val_champ - penalty)
            
        # Recompute season overall as weighted sum + general lift (+5.0)
        overall = (
            0.30 * adj_scores['dominance_score_raw']
            + 0.25 * adj_scores['race_craft_score_raw']
            + 0.20 * adj_scores['qualifying_score_raw']
            + 0.15 * adj_scores['consistency_score_raw']
            + 0.10 * adj_scores['championship_score']
        ) + 5.0
        overall = max(30.0, min(99.0, overall))
        
        return pd.Series([
            adj_scores['dominance_score_raw'],
            adj_scores['race_craft_score_raw'],
            adj_scores['qualifying_score_raw'],
            adj_scores['consistency_score_raw'],
            adj_scores['championship_score'],
            overall
        ])

    df[[
        'dominance_score', 'race_craft_score', 'qualifying_score', 'consistency_score', 'championship_score', 'season_overall'
    ]] = df.apply(apply_baseline_replacement, axis=1)

    # Rename for schema compatibility
    df = df.rename(columns={'PAWE': 'pawe'})

    ratings_df = df[['year', 'driver_id', 'driver_name', 'constructors', 'season_overall',
               'dominance_score', 'race_craft_score', 'qualifying_score',
               'consistency_score', 'championship_score']].rename(
        columns={
            'driver_name': 'component_name',
            'constructors': 'team',
        }
    )

    return ratings_df, df


# ---------------------------------------------------------------------------
# Constructor Ratings (formula.txt Section 3)
# ---------------------------------------------------------------------------

def build_constructor_season_ratings(constructor_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    """Compute per-season constructor ratings.

    CONSTRUCTOR OVERALL = 0.30 × PERFORMANCE
                        + 0.30 × COMPETITIVENESS
                        + 0.25 × ENGINEERING_EXCELLENCE
                        + 0.15 × CHAMPIONSHIP_STANDING
    """
    df = constructor_df[['constructor_id', 'constructor_name', 'year', 'position', 'points',
                          'race_wins', 'pole_positions']].copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_constructors'] = df['n_constructors'].replace(0, 1)
    df['second_place_points'] = df['year'].map(second_place_points)

    # --- Sub-attribute 1: PERFORMANCE (0.30) ---
    df['win_rate'] = df['race_wins'].fillna(0) / df['race_count']
    df['performance_score'] = df.groupby('year')['win_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    # --- Sub-attribute 2: COMPETITIVENESS (0.30) ---
    df['competitiveness_rate'] = df['points'].fillna(0) / df['max_constructor_points']
    df['competitiveness_score'] = df.groupby('year')['competitiveness_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    # --- Sub-attribute 3: ENGINEERING_EXCELLENCE (0.25) ---
    df['pole_rate'] = df['pole_positions'].fillna(0) / df['race_count']
    df['engineering_score'] = df.groupby('year')['pole_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    # --- Sub-attribute 4: CHAMPIONSHIP_STANDING (0.15) ---
    # Direct percentile mapping, NO z-score
    df['champ_percentile'] = df.apply(
        lambda row: 1.0 if row['n_constructors'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_constructors'] - 1)),
        axis=1,
    )
    df['championship_score'] = (df['champ_percentile'] * 100).clip(30, 99)

    # --- Final weighted sum ---
    df['season_overall'] = (
        0.30 * df['performance_score']
        + 0.30 * df['competitiveness_score']
        + 0.25 * df['engineering_score']
        + 0.15 * df['championship_score']
    ).apply(clamp)

    df['team'] = df['constructor_name']

    ratings_df = df[[
        'year', 'constructor_id', 'constructor_name', 'team',
        'position', 'points', 'race_wins', 'pole_positions',
        'season_overall', 'competitiveness_score', 'championship_score',
        'performance_score', 'engineering_score', 'competitiveness_rate',
    ]].rename(columns={'constructor_name': 'component_name'})

    return ratings_df, df


# ---------------------------------------------------------------------------
# Engine Manufacturer Ratings (formula.txt Section 4)
# ---------------------------------------------------------------------------

def build_engine_season_ratings(engine_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    """Compute per-season engine manufacturer ratings.

    ENGINE OVERALL = 0.30 × POWER_OUTPUT_PROXY
                   + 0.25 × RELIABILITY_PROXY
                   + 0.25 × COMPETITIVE_SPREAD
                   + 0.20 × CHAMPIONSHIP_IMPACT
    """
    df = engine_df[['year', 'team_name', 'engine_manufacturer_name', 'position', 'points',
                     'race_wins', 'pole_positions']].copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_constructors'] = df['n_constructors'].replace(0, 1)
    df['team_name'] = df['team_name'].fillna('Unknown')

    # Pre-compute per-team rate metrics for write-back to source table
    df['pole_rate'] = df['pole_positions'].fillna(0) / df['race_count']
    df['points_harvest_rate'] = df['points'].fillna(0) / df['max_constructor_points']
    df['second_place_points'] = df['year'].map(second_place_points)

    # Aggregate metrics per engine manufacturer per year
    records = []
    for (year, engine_name), group in df.groupby(['year', 'engine_manufacturer_name']):
        # Power Output Proxy: best pole rate among all teams using this engine
        pole_rates = group['pole_positions'].fillna(0) / group['race_count']

        # Reliability Proxy: average points harvest across all teams
        avg_harvest = (group['points'].fillna(0) / group['max_constructor_points']).mean()

        # Competitive Spread: proportion of teams in top half of championship
        top_half = math.ceil(group['n_constructors'].iloc[0] / 2)
        competitive_ratio = (group['position'].le(top_half).sum() / len(group)) if len(group) > 0 else 0.0

        # Championship Impact: best position among teams
        best_position = group['position'].min()

        teams = ', '.join(sorted(set(group['team_name'].dropna())))
        records.append({
            'year': year,
            'engine_manufacturer_name': engine_name,
            'pole_rate_max': pole_rates.max(),
            'avg_harvest': avg_harvest,
            'competitive_ratio': competitive_ratio,
            'best_position': best_position,
            'teams': teams,
            'n_constructors': group['n_constructors'].iloc[0],
        })

    engine_metrics = pd.DataFrame(records)

    # --- Apply Z-score → Φ → 0-100 → clamp ---
    engine_metrics['power_score'] = engine_metrics.groupby('year')['pole_rate_max'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    engine_metrics['reliability_score'] = engine_metrics.groupby('year')['avg_harvest'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    engine_metrics['spread_score'] = engine_metrics.groupby('year')['competitive_ratio'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    # Championship Impact: direct percentile, NO z-score
    engine_metrics['championship_score'] = engine_metrics.apply(
        lambda row: 100.0 if row['n_constructors'] <= 1 else clamp((1.0 - ((row['best_position'] - 1) / (row['n_constructors'] - 1))) * 100, 30, 99),
        axis=1,
    )

    # --- Final weighted sum ---
    engine_metrics['season_overall'] = (
        0.30 * engine_metrics['power_score']
        + 0.25 * engine_metrics['reliability_score']
        + 0.25 * engine_metrics['spread_score']
        + 0.20 * engine_metrics['championship_score']
    ).apply(clamp)

    engine_metrics['component_name'] = engine_metrics['engine_manufacturer_name']
    engine_metrics['team'] = engine_metrics['teams']

    ratings_df = engine_metrics[[
        'year', 'component_name', 'team', 'season_overall',
        'power_score', 'reliability_score', 'spread_score', 'championship_score',
    ]]

    return ratings_df, df


# ---------------------------------------------------------------------------
# Team Principal / Chief Engineer / Car Designer Ratings (formula.txt Section 5)
# ---------------------------------------------------------------------------

def build_team_leader_ratings(
    personnel_df: pd.DataFrame,
    constructor_ratings_df: pd.DataFrame,
    year_counts: pd.DataFrame,
    role: str,
) -> pd.DataFrame:
    """Compute per-season team leader ratings.

    TP/ENGINEER OVERALL = 0.30 × RESULTS_DELIVERY
                        + 0.25 × DEVELOPMENT_TRAJECTORY
                        + 0.20 × RESOURCE_EFFICIENCY
                        + 0.15 × OPERATIONAL_EXCELLENCE
                        + 0.10 × LONGEVITY_STABILITY

    IMPORTANT: constructor_ratings_df must be the COMPUTED constructor ratings
    (output of build_constructor_season_ratings), not the raw constructor_seasons
    table, so that results_delivery and operational_excellence use the correct values.
    """
    # Prepare constructor data with computed ratings
    constructors = constructor_ratings_df.copy()
    # component_name was renamed from constructor_name, rename back to 'team' for merging
    if 'team' in constructors.columns:
        constructors = constructors.drop(columns=['team'])
    constructors = constructors.rename(columns={'component_name': 'team'})

    # Merge personnel with computed constructor data
    base_cols = ['year', 'name', 'team']
    if 'driver' in personnel_df.columns:
        base_cols.append('driver')
    personnel = personnel_df[base_cols].copy()
    personnel = personnel.merge(
        constructors[['year', 'team', 'season_overall', 'competitiveness_score',
                       'championship_score', 'competitiveness_rate']],
        on=['year', 'team'],
        how='left',
    )

    # --- Sub-attribute 1: RESULTS_DELIVERY (0.30) ---
    # Uses the COMPUTED constructor season overall, not raw data
    personnel['constructor_season_overall'] = personnel['season_overall']
    personnel['results_delivery'] = personnel['season_overall'].fillna(30)

    # --- Sub-attribute 2: DEVELOPMENT_TRAJECTORY (0.25) ---
    # Δ_percentile = champ_percentile(Y) - champ_percentile(Y-1)
    # For first season under this leader: Δ = 0
    # Score = (Δ + 1) / 2 × 100, clamped to [30, 99]
    #
    # We need champ_percentile from constructor data
    constructors_for_percentile = constructor_ratings_df.copy()
    if 'team' in constructors_for_percentile.columns:
        constructors_for_percentile = constructors_for_percentile.drop(columns=['team'])
    constructors_for_percentile = constructors_for_percentile.rename(columns={'component_name': 'team'})
    constructors_for_percentile = constructors_for_percentile.merge(year_counts, on='year', how='left')
    constructors_for_percentile['n_constructors'] = constructors_for_percentile['n_constructors'].replace(0, 1)
    constructors_for_percentile['champ_percentile'] = constructors_for_percentile.apply(
        lambda row: 1.0 if row['n_constructors'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_constructors'] - 1)),
        axis=1,
    )

    personnel = personnel.merge(
        constructors_for_percentile[['year', 'team', 'champ_percentile']],
        on=['year', 'team'],
        how='left',
    )
    personnel['champ_percentile'] = personnel['champ_percentile'].fillna(0.0)

    personnel = personnel.sort_values(['name', 'team', 'year'])
    personnel['previous_champ_percentile'] = (
        personnel.groupby(['name', 'team'])['champ_percentile']
        .shift(1)
        .fillna(personnel['champ_percentile'])
    )
    personnel['development_delta'] = personnel['champ_percentile'] - personnel['previous_champ_percentile']
    personnel['development_delta'] = personnel['development_delta'].fillna(0.0)
    personnel['development_score'] = ((personnel['development_delta'] + 1.0) / 2.0 * 100).clip(30, 99)

    # --- Sub-attribute 3: RESOURCE_EFFICIENCY (0.20) ---
    # overperformance = champ_percentile - historical_avg(team)
    # Then z-score across all leaders in that year → Φ → 0-100
    personnel['historical_avg_percentile'] = personnel.groupby('team')['champ_percentile'].transform('mean')
    personnel['overperformance'] = personnel['champ_percentile'] - personnel['historical_avg_percentile'].fillna(0.0)
    personnel['resource_score'] = (
        personnel.groupby('year')['overperformance']
        .transform(z_score)
        .pipe(lambda s: normal_cdf(s) * 100)
        .clip(30, 99)
    )

    # --- Sub-attribute 4: OPERATIONAL_EXCELLENCE (0.15) ---
    # Uses the COMPUTED constructor competitiveness score directly
    # (formula.txt line 677: OPERATIONAL_EXCELLENCE = COMPETITIVENESS(C, Y))
    personnel['operational_score'] = personnel['competitiveness_score'].fillna(30).clip(30, 99)

    # --- Sub-attribute 5: LONGEVITY_STABILITY (0.10) ---
    # streak = consecutive seasons with champ_percentile >= 0.5
    # longevity_raw = min(log2(streak+1) / log2(16), 1.0) × 100
    streaks = []
    for _, group in personnel.groupby(['name', 'team']):
        current_streak = 0
        previous_year = None
        for idx, row in group.iterrows():
            if row['champ_percentile'] >= 0.5:
                if previous_year is not None and row['year'] == previous_year + 1:
                    current_streak += 1
                else:
                    current_streak = 1
            else:
                current_streak = 0
            streaks.append((idx, current_streak))
            previous_year = row['year']
    personnel['streak'] = pd.Series({idx: streak for idx, streak in streaks})
    personnel['longevity_score'] = personnel['streak'].apply(
        lambda streak: min(math.log2(streak + 1) / math.log2(16), 1.0) * 100 if streak > 0 else 0.0
    ).clip(30, 99)

    # --- Final weighted sum ---
    personnel['season_overall'] = (
        0.30 * personnel['results_delivery']
        + 0.25 * personnel['development_score']
        + 0.20 * personnel['resource_score']
        + 0.15 * personnel['operational_score']
        + 0.10 * personnel['longevity_score']
    ).apply(clamp)

    # Prepare enriched columns for write-back to source table
    personnel['constructor_match'] = personnel.apply(
        lambda row: row['team'] if pd.notna(row.get('constructor_season_overall')) else None,
        axis=1,
    )
    personnel['prev_champ_percentile'] = personnel['previous_champ_percentile']

    ratings_df = personnel.rename(columns={'name': 'component_name'})[[
        'year', 'component_name', 'team', 'season_overall',
        'results_delivery', 'development_score', 'resource_score',
        'operational_score', 'longevity_score',
    ]].assign(role=role)

    return ratings_df, personnel


# ---------------------------------------------------------------------------
# Database Output
# ---------------------------------------------------------------------------

def create_component_ratings_table():
    """Create (or recreate) the component_ratings table with indexes."""
    with engine.connect() as conn:
        conn.execute(text('DROP TABLE IF EXISTS component_ratings CASCADE'))
        conn.execute(text(
            'CREATE TABLE component_ratings ('
            ' year INT NOT NULL,'
            ' role TEXT NOT NULL,'
            ' component_name TEXT NOT NULL,'
            ' team TEXT,'
            ' raw_score FLOAT NOT NULL,'
            ' normalized_score FLOAT NOT NULL,'
            ' rating FLOAT NOT NULL,'
            ' source TEXT NOT NULL'
            ')'
        ))
        # Add indexes for the draft service query pattern (year + role)
        conn.execute(text('CREATE INDEX idx_component_ratings_year_role ON component_ratings (year, role)'))
        conn.execute(text('CREATE INDEX idx_component_ratings_component_name ON component_ratings (component_name)'))
        conn.commit()


def create_career_ratings_table():
    """Create (or recreate) the career_ratings table."""
    with engine.connect() as conn:
        conn.execute(text('DROP TABLE IF EXISTS career_ratings CASCADE'))
        conn.execute(text(
            'CREATE TABLE career_ratings ('
            ' role TEXT NOT NULL,'
            ' component_name TEXT NOT NULL,'
            ' career_overall FLOAT NOT NULL,'
            ' seasons_count INT NOT NULL,'
            ' peak_season_overall FLOAT NOT NULL,'
            ' latest_year INT NOT NULL'
            ')'
        ))
        conn.execute(text('CREATE INDEX idx_career_ratings_role ON career_ratings (role)'))
        conn.execute(text('CREATE INDEX idx_career_ratings_name ON career_ratings (component_name)'))
        conn.commit()


def create_decade_ratings_table():
    """Create (or recreate) the decade_ratings table."""
    with engine.connect() as conn:
        conn.execute(text('DROP TABLE IF EXISTS decade_ratings CASCADE'))
        conn.execute(text(
            'CREATE TABLE decade_ratings ('
            ' role TEXT NOT NULL,'
            ' component_name TEXT NOT NULL,'
            ' decade TEXT NOT NULL,'
            ' rating FLOAT NOT NULL,'
            ' seasons_count INT NOT NULL,'
            ' peak_season_overall FLOAT NOT NULL,'
            ' latest_year INT NOT NULL'
            ')'
        ))
        conn.execute(text('CREATE INDEX idx_decade_ratings_role_decade ON decade_ratings (role, decade)'))
        conn.execute(text('CREATE INDEX idx_decade_ratings_name ON decade_ratings (component_name)'))
        conn.commit()


def save_to_table(df: pd.DataFrame, table_name: str):
    """Append a DataFrame to the specified table."""
    with engine.connect() as conn:
        df.to_sql(table_name, conn, if_exists='append', index=False)


# ---------------------------------------------------------------------------
# Sanity Checks (formula.txt sanity check examples)
# ---------------------------------------------------------------------------

def run_sanity_checks(component_ratings: pd.DataFrame):
    """Print sanity check outputs for known benchmark entities."""
    checks = [
        # (role, name, year_range, expected_min, expected_max)
        ('driver', 'Michael Schumacher', (2001, 2004), 96, 98),
        ('driver', 'Lewis Hamilton', (2017, 2020), 96, 98),
        ('driver', 'Max Verstappen', (2023, 2023), 97, 99),
        ('chassis', 'Ferrari', (2000, 2004), 94, 97),
        ('chassis', 'Mercedes', (2014, 2020), 95, 98),
        ('chassis', 'Red Bull', (2010, 2013), 93, 96),
    ]

    print('\n--- SANITY CHECKS ---')
    all_passed = True
    for role, name, (y_start, y_end), exp_min, exp_max in checks:
        # Match all parts of the query name (handles middle names)
        name_mask = component_ratings['component_name'].apply(
            lambda x: all(part.lower() in str(x).lower() for part in name.split())
        )
        mask = (
            (component_ratings['role'] == role)
            & name_mask
            & (component_ratings['year'] >= y_start)
            & (component_ratings['year'] <= y_end)
        )
        subset = component_ratings[mask]
        if subset.empty:
            print(f'  ⚠ {name} ({role}, {y_start}-{y_end}): NOT FOUND in data')
            continue

        avg_rating = subset['rating'].mean()
        status = '✅' if exp_min <= avg_rating <= exp_max else '⚠️'
        if status == '⚠️':
            all_passed = False
        print(f'  {status} {name} ({role}, {y_start}-{y_end}): avg={avg_rating:.1f}  (expected {exp_min}-{exp_max})')

    if all_passed:
        print('  All sanity checks passed.\n')
    else:
        print('  Some sanity checks outside expected range — review formula weights.\n')


# ---------------------------------------------------------------------------
# Main Pipeline
# ---------------------------------------------------------------------------

def main():
    print('Loading tables from database...')
    driver_df = load_table('driver_seasons')
    constructor_df = load_table('constructor_seasons')
    constructor_engine_df = load_table('constructor_seasons_with_engines')
    car_designers_df = load_table('car_designers')
    team_principals_df = load_table('team_principals')
    team_engineers_df = load_table('team_engineers')

    year_counts = load_year_counts()

    # ------------------------------------------------------------------
    # 1. DRIVER SEASON RATINGS
    # ------------------------------------------------------------------
    print('Building driver season ratings...')
    driver_ratings, driver_enriched = build_driver_season_ratings(driver_df, year_counts)
    driver_ratings = driver_ratings.assign(
        role='driver',
        raw_score=lambda d: d['dominance_score'],
        normalized_score=lambda d: d['race_craft_score'],
        rating=lambda d: d['season_overall'],
        source='driver_seasons',
    )

    # ------------------------------------------------------------------
    # 2. CONSTRUCTOR (CHASSIS) SEASON RATINGS
    # ------------------------------------------------------------------
    print('Building constructor season ratings...')
    constructor_ratings, constructor_enriched = build_constructor_season_ratings(constructor_df, year_counts)
    constructor_ratings = constructor_ratings.assign(
        role='chassis',
        raw_score=lambda d: d['performance_score'],
        normalized_score=lambda d: d['competitiveness_score'],
        rating=lambda d: d['season_overall'],
        source='constructor_seasons',
    )

    # ------------------------------------------------------------------
    # 3. ENGINE SEASON RATINGS
    # ------------------------------------------------------------------
    print('Building engine season ratings...')
    engine_ratings, engine_enriched = build_engine_season_ratings(constructor_engine_df, year_counts)
    engine_ratings = engine_ratings.assign(
        role='engine',
        raw_score=lambda d: d['power_score'],
        normalized_score=lambda d: d['reliability_score'],
        rating=lambda d: d['season_overall'],
        source='constructor_seasons_with_engines',
    )

    # ------------------------------------------------------------------
    # 4. TEAM PRINCIPAL SEASON RATINGS
    #    (uses COMPUTED constructor_ratings, not raw constructor_df)
    # ------------------------------------------------------------------
    print('Building team principal ratings...')
    tp_ratings, tp_enriched = build_team_leader_ratings(team_principals_df, constructor_ratings, year_counts, 'team_principal')
    tp_ratings = tp_ratings.assign(
        raw_score=lambda d: d['results_delivery'],
        normalized_score=lambda d: d['development_score'],
        rating=lambda d: d['season_overall'],
        source='team_principals',
    )

    # ------------------------------------------------------------------
    # 5. CHIEF ENGINEER SEASON RATINGS
    # ------------------------------------------------------------------
    print('Building chief engineer ratings...')
    engineer_ratings, engineer_enriched = build_team_leader_ratings(team_engineers_df, constructor_ratings, year_counts, 'chief_engineer')
    engineer_ratings = engineer_ratings.assign(
        raw_score=lambda d: d['results_delivery'],
        normalized_score=lambda d: d['development_score'],
        rating=lambda d: d['season_overall'],
        source='team_engineers',
    )

    # ------------------------------------------------------------------
    # 6. CAR DESIGNER SEASON RATINGS
    # ------------------------------------------------------------------
    print('Building car designer ratings...')
    car_designer_ratings, designer_enriched = build_team_leader_ratings(car_designers_df, constructor_ratings, year_counts, 'car_designer')
    car_designer_ratings = car_designer_ratings.assign(
        raw_score=lambda d: d['results_delivery'],
        normalized_score=lambda d: d['development_score'],
        rating=lambda d: d['season_overall'],
        source='car_designers',
    )

    # ------------------------------------------------------------------
    # WRITE ENRICHED DATA BACK TO SOURCE TABLES
    # ------------------------------------------------------------------
    print('\nWriting enriched intermediate data back to source tables...')

    write_back_source_table(driver_enriched, 'driver_seasons', [
        'driver_id', 'driver_name', 'year', 'position', 'points',
        'race_wins', 'pole_positions', 'constructors',
        'race_count', 'max_win_points', 'max_points_available', 'n_drivers',
        'win_rate', 'points_rate', 'dominance_rate',
        'normalized_position', 'pawe',
        'pole_rate',
        'points_harvest_rate', 'consistency_raw',
        'champ_percentile',
    ])

    write_back_source_table(constructor_enriched, 'constructor_seasons', [
        'constructor_id', 'constructor_name', 'year', 'position', 'points',
        'race_wins', 'pole_positions',
        'race_count', 'max_win_points', 'second_place_points',
        'max_constructor_points', 'n_constructors',
        'win_rate',
        'competitiveness_rate',
        'pole_rate',
        'champ_percentile',
    ])

    write_back_source_table(engine_enriched, 'constructor_seasons_with_engines', [
        'year', 'team_name', 'engine_manufacturer_name', 'position', 'points',
        'race_wins', 'pole_positions',
        'race_count', 'max_win_points', 'second_place_points',
        'max_constructor_points', 'n_constructors',
        'pole_rate', 'points_harvest_rate',
    ])

    personnel_write_cols = [
        'year', 'name', 'team',
        'constructor_match',
        'constructor_season_overall', 'competitiveness_score', 'champ_percentile',
        'prev_champ_percentile', 'development_delta',
        'historical_avg_percentile', 'overperformance',
        'streak',
    ]
    write_back_source_table(tp_enriched, 'team_principals', personnel_write_cols)
    write_back_source_table(designer_enriched, 'car_designers', personnel_write_cols)
    write_back_source_table(engineer_enriched, 'team_engineers',
                            personnel_write_cols + ['driver'])

    # ------------------------------------------------------------------
    # Assemble all season ratings into component_ratings
    # ------------------------------------------------------------------
    output_columns = ['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']

    print('Assembling component_ratings...')
    component_ratings = pd.concat([
        driver_ratings[output_columns],
        constructor_ratings[output_columns],
        engine_ratings[output_columns],
        tp_ratings[output_columns],
        engineer_ratings[output_columns],
        car_designer_ratings[output_columns],
    ], ignore_index=True)

    # ------------------------------------------------------------------
    # Write season ratings to database
    # ------------------------------------------------------------------
    print('Creating component_ratings table...')
    create_component_ratings_table()
    print(f'Writing {len(component_ratings)} rows to component_ratings...')
    save_to_table(component_ratings, 'component_ratings')

    # ------------------------------------------------------------------
    # Compute and write career ratings
    # ------------------------------------------------------------------
    print('Computing career aggregations...')
    career_frames = []

    for role, ratings_df in [
        ('driver', driver_ratings),
        ('chassis', constructor_ratings),
        ('engine', engine_ratings),
        ('team_principal', tp_ratings),
        ('chief_engineer', engineer_ratings),
        ('car_designer', car_designer_ratings),
    ]:
        career = compute_career_overall(ratings_df, 'component_name')
        career['role'] = role
        career_frames.append(career)

    career_ratings = pd.concat(career_frames, ignore_index=True)

    print('Creating career_ratings table...')
    create_career_ratings_table()
    print(f'Writing {len(career_ratings)} rows to career_ratings...')
    save_to_table(career_ratings, 'career_ratings')

    # ------------------------------------------------------------------
    # Compute and write decade ratings
    # ------------------------------------------------------------------
    print('Computing decade aggregations...')
    decade_frames = []

    for role, ratings_df in [
        ('driver', driver_ratings),
        ('chassis', constructor_ratings),
        ('engine', engine_ratings),
        ('team_principal', tp_ratings),
        ('chief_engineer', engineer_ratings),
        ('car_designer', car_designer_ratings),
    ]:
        decade_df = compute_decade_overall(ratings_df, 'component_name')
        decade_df['role'] = role
        decade_frames.append(decade_df)

    decade_ratings = pd.concat(decade_frames, ignore_index=True)

    print('Creating decade_ratings table...')
    create_decade_ratings_table()
    print(f'Writing {len(decade_ratings)} rows to decade_ratings...')
    save_to_table(decade_ratings, 'decade_ratings')

    # ------------------------------------------------------------------
    # Sanity checks
    # ------------------------------------------------------------------
    run_sanity_checks(component_ratings)

    print('Done. component_ratings, career_ratings, and decade_ratings tables are ready.')


if __name__ == '__main__':
    main()
