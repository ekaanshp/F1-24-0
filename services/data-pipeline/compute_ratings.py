#!/usr/bin/env python3
import math
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

SCRIPT_DIR = Path(__file__).resolve().parent
ROOT_DIR = SCRIPT_DIR.parents[1]
load_dotenv(dotenv_path=ROOT_DIR / '.env.local')

DB_URL = os.getenv('DATABASE_URL')
if not DB_URL:
    raise RuntimeError('DATABASE_URL not found in .env.local')

engine = create_engine(DB_URL)

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


def clamp(value: float, minimum: float = 30.0, maximum: float = 99.0) -> float:
    return float(max(minimum, min(maximum, value)))


def normal_cdf(z: pd.Series | float) -> pd.Series | float:
    if isinstance(z, pd.Series):
        return 0.5 * (1.0 + z.apply(lambda x: math.erf(x / math.sqrt(2))))
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2)))


def z_score(series: pd.Series) -> pd.Series:
    std = series.std(ddof=0)
    if std == 0 or math.isnan(std):
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def get_race_count(year: int) -> int:
    return RACES_PER_YEAR.get(year, 24)


def max_win_points(year: int) -> int:
    if year <= 1959:
        return 8
    if year == 1960:
        return 8
    if year <= 2009:
        return 10
    return 25


def second_place_points(year: int) -> int:
    if year <= 2009:
        return 6 if year <= 2002 else 8
    return 18


def load_table(table_name: str) -> pd.DataFrame:
    with engine.connect() as conn:
        return pd.read_sql(text(f'SELECT * FROM {table_name}'), conn)


def load_year_counts() -> pd.DataFrame:
    with engine.connect() as conn:
        drivers = pd.read_sql(
            text('SELECT year, COUNT(DISTINCT driver_id) AS n_drivers FROM driver_seasons GROUP BY year'),
            conn,
        )
        constructors = pd.read_sql(
            text('SELECT year, COUNT(DISTINCT constructor_id) AS n_constructors FROM constructor_seasons GROUP BY year'),
            conn,
        )
    return drivers.merge(constructors, on='year', how='outer').fillna(0).astype({'year': int, 'n_drivers': int, 'n_constructors': int})


def map_year_metadata(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['year'] = df['year'].astype(int)
    df['race_count'] = df['year'].map(get_race_count)
    df['max_win_points'] = df['year'].map(max_win_points)
    df['max_constructor_points'] = (df['max_win_points'] + df['year'].map(second_place_points)) * df['race_count']
    df['max_points_available'] = df['max_win_points'] * df['race_count']
    return df


def build_driver_season_ratings(driver_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    df = driver_df.copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_drivers'] = df['n_drivers'].replace(0, 1)

    df['win_rate'] = df['race_wins'].fillna(0) / df['race_count']
    df['points_rate'] = df['points'].fillna(0) / df['max_points_available']
    df['dominance_rate'] = (df['win_rate'] * df['points_rate']).pow(0.5)
    df['normalized_position'] = df.apply(
        lambda row: 1.0 if row['n_drivers'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_drivers'] - 1)),
        axis=1,
    )
    df['PAWE'] = 0.6 * df['win_rate'] + 0.4 * df['normalized_position']
    df['pole_rate'] = df['pole_positions'].fillna(0) / df['race_count']
    df['points_harvest_rate'] = df['points'].fillna(0) / df['max_points_available']
    df['consistency_raw'] = df['points_harvest_rate'] / df.groupby('year')['points_harvest_rate'].transform('max').replace(0, 1)
    df['champ_percentile'] = df.apply(
        lambda row: 1.0 if row['n_drivers'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_drivers'] - 1)),
        axis=1,
    )

    df['dominance_score'] = df.groupby('year')['dominance_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['race_craft_score'] = df.groupby('year')['PAWE'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['qualifying_score'] = df.groupby('year')['pole_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['consistency_score'] = df.groupby('year')['consistency_raw'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['championship_score'] = df['champ_percentile'] * 100
    df['championship_score'] = df['championship_score'].clip(30, 99)

    df['season_overall'] = (
        0.30 * df['dominance_score']
        + 0.25 * df['race_craft_score']
        + 0.20 * df['qualifying_score']
        + 0.15 * df['consistency_score']
        + 0.10 * df['championship_score']
    )
    df['season_overall'] = df['season_overall'].apply(clamp)

    return df[['year', 'driver_id', 'driver_name', 'constructors', 'season_overall']].rename(
        columns={
            'driver_name': 'component_name',
            'constructors': 'team',
        }
    )


def build_constructor_season_ratings(constructor_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    df = constructor_df.copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_constructors'] = df['n_constructors'].replace(0, 1)

    df['win_rate'] = df['race_wins'].fillna(0) / df['race_count']
    df['performance_score'] = df.groupby('year')['win_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['competitiveness_rate'] = df['points'].fillna(0) / df['max_constructor_points']
    df['competitiveness_score'] = df.groupby('year')['competitiveness_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['pole_rate'] = df['pole_positions'].fillna(0) / df['race_count']
    df['engineering_score'] = df.groupby('year')['pole_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['championship_score'] = df.apply(
        lambda row: 1.0 if row['n_constructors'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_constructors'] - 1)),
        axis=1,
    ) * 100
    df['championship_score'] = df['championship_score'].clip(30, 99)

    df['season_overall'] = (
        0.30 * df['performance_score']
        + 0.30 * df['competitiveness_score']
        + 0.25 * df['engineering_score']
        + 0.15 * df['championship_score']
    )
    df['season_overall'] = df['season_overall'].apply(clamp)

    df['team'] = df['constructor_name']
    return df[[
        'year',
        'constructor_id',
        'constructor_name',
        'team',
        'position',
        'points',
        'race_wins',
        'pole_positions',
        'season_overall',
        'competitiveness_rate',
        'championship_score',
    ]].rename(columns={'constructor_name': 'component_name'})


def build_engine_season_ratings(engine_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    df = engine_df.copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_constructors'] = df['n_constructors'].replace(0, 1)

    df['team_name'] = df['team_name'].fillna('Unknown')
    grouped = df.groupby(['year', 'engine_manufacturer_name'], as_index=False)

    engine_metrics = grouped.agg(
        pole_rate_max=('pole_positions', lambda x: (x.fillna(0) / x.index.map(lambda _ : 1)).max()),
        avg_harvest=('points', lambda pts: (pts.fillna(0) / df.loc[pts.index, 'max_constructor_points']).mean()),
        team_count=('team_name', 'nunique'),
        best_position=('position', 'min'),
        teams=('team_name', lambda x: ', '.join(sorted(set(x.dropna())))),
        year=('year', 'first'),
    )

    # Correct pole_rate_max computation using grouped row-wise values
    engine_metrics = engine_metrics.drop(columns=['pole_rate_max'])
    temp = []
    for (year, engine), group in df.groupby(['year', 'engine_manufacturer_name']):
        pole_rates = group['pole_positions'].fillna(0) / group['race_count']
        avg_harvest = (group['points'].fillna(0) / group['max_constructor_points']).mean()
        top_half = math.ceil(group['n_constructors'].iloc[0] / 2)
        competitive_ratio = (group['position'].le(top_half).sum() / len(group)) if len(group) > 0 else 0.0
        best_position = group['position'].min()
        teams = ', '.join(sorted(set(group['team_name'].dropna())))
        temp.append({
            'year': year,
            'engine_manufacturer_name': engine,
            'pole_rate_max': pole_rates.max(),
            'avg_harvest': avg_harvest,
            'competitive_ratio': competitive_ratio,
            'best_position': best_position,
            'teams': teams,
            'n_constructors': group['n_constructors'].iloc[0],
        })
    engine_metrics = pd.DataFrame(temp)

    engine_metrics['power_score'] = engine_metrics.groupby('year')['pole_rate_max'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    engine_metrics['reliability_score'] = engine_metrics.groupby('year')['avg_harvest'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    engine_metrics['spread_score'] = engine_metrics.groupby('year')['competitive_ratio'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    engine_metrics['championship_score'] = engine_metrics.apply(
        lambda row: 100.0 if row['n_constructors'] <= 1 else clamp((1.0 - ((row['best_position'] - 1) / (row['n_constructors'] - 1))) * 100, 30, 99),
        axis=1,
    )

    engine_metrics['season_overall'] = (
        0.30 * engine_metrics['power_score']
        + 0.25 * engine_metrics['reliability_score']
        + 0.25 * engine_metrics['spread_score']
        + 0.20 * engine_metrics['championship_score']
    ).apply(clamp)

    engine_metrics['component_name'] = engine_metrics['engine_manufacturer_name']
    engine_metrics['team'] = engine_metrics['teams']

    return engine_metrics[[
        'year',
        'component_name',
        'team',
        'season_overall',
        'power_score',
        'reliability_score',
        'spread_score',
        'championship_score',
    ]]


def build_pitcrew_season_ratings(constructor_df: pd.DataFrame, year_counts: pd.DataFrame) -> pd.DataFrame:
    df = constructor_df.copy()
    df = map_year_metadata(df)
    df = df.merge(year_counts, on='year', how='left')
    df['n_constructors'] = df['n_constructors'].replace(0, 1)

    df['win_rate'] = df['race_wins'].fillna(0) / df['race_count']
    df['points_harvest_rate'] = df['points'].fillna(0) / df['max_constructor_points']
    df['pole_to_win_ratio'] = df.apply(
        lambda row: row['race_wins'] / row['pole_positions'] if row['pole_positions'] > 0 else (1.5 if row['race_wins'] > 0 else row['points_harvest_rate']),
        axis=1,
    )
    df['execution_rate'] = df['pole_to_win_ratio']
    df['points_per_race'] = df['points'].fillna(0) / df['race_count']
    df['balance_ratio'] = df.apply(
        lambda row: 1.0 - abs(row['win_rate'] - row['points_harvest_rate']) if (row['points'] or 0) > 0 else 0.0,
        axis=1,
    )
    df['max_points_year'] = df.groupby('year')['points'].transform('max').replace(0, 1)
    df['champ_proximity'] = df['points'].fillna(0) / df['max_points_year']

    df['execution_score'] = df.groupby('year')['execution_rate'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['race_day_score'] = df.groupby('year')['points_per_race'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['strategic_score'] = df.groupby('year')['balance_ratio'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    df['operational_score'] = df.groupby('year')['champ_proximity'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    df['season_overall'] = (
        0.35 * df['execution_score']
        + 0.30 * df['race_day_score']
        + 0.20 * df['strategic_score']
        + 0.15 * df['operational_score']
    ).apply(clamp)

    return df.rename(columns={'constructor_name': 'team'})[[
        'year',
        'team',
        'season_overall',
        'execution_score',
        'race_day_score',
        'strategic_score',
        'operational_score',
    ]].assign(component_name=lambda d: d['team'])


def build_team_leader_ratings(personnel_df: pd.DataFrame, constructor_df: pd.DataFrame, year_counts: pd.DataFrame, role: str) -> pd.DataFrame:
    drivers = constructor_df.copy()
    drivers = drivers.rename(columns={'constructor_name': 'team'})
    drivers = map_year_metadata(drivers)
    drivers = drivers.merge(year_counts, on='year', how='left')
    drivers['n_constructors'] = drivers['n_constructors'].replace(0, 1)
    drivers['champ_percentile'] = drivers.apply(
        lambda row: 1.0 if row['n_constructors'] <= 1 else 1.0 - ((row['position'] - 1) / (row['n_constructors'] - 1)),
        axis=1,
    )
    drivers['competitiveness_rate'] = drivers['points'].fillna(0) / drivers['max_constructor_points']
    drivers['season_overall'] = drivers['season_overall'] if 'season_overall' in drivers.columns else drivers['points']

    personnel = personnel_df.copy()
    personnel = personnel.merge(
        drivers[['year', 'team', 'season_overall', 'champ_percentile', 'competitiveness_rate']],
        on=['year', 'team'],
        how='left',
    )
    personnel['results_delivery'] = personnel['season_overall'].fillna(30)

    personnel = personnel.sort_values(['name', 'team', 'year'])
    personnel['previous_champ_percentile'] = personnel.groupby(['name', 'team'])['champ_percentile'].shift(1).fillna(personnel['champ_percentile'])
    personnel['development_delta'] = personnel['champ_percentile'] - personnel['previous_champ_percentile']
    personnel['development_delta'] = personnel['development_delta'].fillna(0.0)
    personnel['development_score'] = ((personnel['development_delta'] + 1.0) / 2.0 * 100).clip(30, 99)

    historical_avg = personnel.groupby(['team'])['champ_percentile'].transform('mean')
    personnel['overperformance'] = personnel['champ_percentile'].fillna(0.0) - historical_avg.fillna(0.0)
    personnel['resource_score'] = personnel.groupby('year')['overperformance'].transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)
    personnel['operational_score'] = personnel['competitiveness_rate'].fillna(0).pipe(lambda s: s)
    personnel['operational_score'] = personnel['operational_score'].groupby(personnel['year']).transform(z_score).pipe(lambda s: normal_cdf(s) * 100).clip(30, 99)

    personnel['streak'] = 0
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

    personnel['season_overall'] = (
        0.30 * personnel['results_delivery']
        + 0.25 * personnel['development_score']
        + 0.20 * personnel['resource_score']
        + 0.15 * personnel['operational_score']
        + 0.10 * personnel['longevity_score']
    ).apply(clamp)

    return personnel.rename(columns={'name': 'component_name'})[[
        'year',
        'component_name',
        'team',
        'season_overall',
        'results_delivery',
        'development_score',
        'resource_score',
        'operational_score',
        'longevity_score',
    ]].assign(role=role)


def create_component_ratings_table():
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
        conn.commit()


def save_component_ratings(df: pd.DataFrame):
    with engine.connect() as conn:
        df.to_sql('component_ratings', conn, if_exists='append', index=False)


def main():
    print('Loading tables from database...')
    driver_df = load_table('driver_seasons')
    constructor_df = load_table('constructor_seasons')
    constructor_engine_df = load_table('constructor_seasons_with_engines')
    car_designers_df = load_table('car_designers')
    team_principals_df = load_table('team_principals')
    team_engineers_df = load_table('team_engineers')

    year_counts = load_year_counts()

    print('Building driver season ratings...')
    driver_ratings = build_driver_season_ratings(driver_df, year_counts)
    driver_ratings = driver_ratings.assign(
        role='driver',
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='driver_seasons',
    )

    print('Building constructor season ratings...')
    constructor_ratings = build_constructor_season_ratings(constructor_df, year_counts)
    constructor_ratings = constructor_ratings.assign(
        role='chassis',
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='constructor_seasons',
    )

    print('Building engine season ratings...')
    engine_ratings = build_engine_season_ratings(constructor_engine_df, year_counts)
    engine_ratings = engine_ratings.assign(
        role='engine',
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='constructor_seasons_with_engines',
    )

    print('Building pit crew ratings...')
    pitcrew_ratings = build_pitcrew_season_ratings(constructor_df, year_counts)
    pitcrew_ratings = pitcrew_ratings.assign(
        role='pit_crew',
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='constructor_seasons',
    )

    print('Building team principal ratings...')
    tp_ratings = build_team_leader_ratings(team_principals_df, constructor_df, year_counts, 'team_principal')
    tp_ratings = tp_ratings.assign(
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='team_principals',
    )

    print('Building chief engineer ratings...')
    engineer_ratings = build_team_leader_ratings(team_engineers_df, constructor_df, year_counts, 'chief_engineer')
    engineer_ratings = engineer_ratings.assign(
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='team_engineers',
    )

    print('Building car designer ratings...')
    car_designer_ratings = build_team_leader_ratings(car_designers_df, constructor_df, year_counts, 'car_designer')
    car_designer_ratings = car_designer_ratings.assign(
        raw_score=lambda d: d['season_overall'],
        normalized_score=lambda d: d['season_overall'],
        rating=lambda d: d['season_overall'],
        source='car_designers',
    )

    print('Assembling component_ratings...')
    output_frames = [
        driver_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        constructor_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        engine_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        pitcrew_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        tp_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        engineer_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
        car_designer_ratings[['year', 'role', 'component_name', 'team', 'raw_score', 'normalized_score', 'rating', 'source']],
    ]
    component_ratings = pd.concat(output_frames, ignore_index=True)

    print('Creating component_ratings table...')
    create_component_ratings_table()
    print(f'Writing {len(component_ratings)} rows to component_ratings...')
    save_component_ratings(component_ratings)
    print('Done. component_ratings table is ready.')


if __name__ == '__main__':
    main()
