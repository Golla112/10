"""
Complete Sports API Service - Tutti gli sport, campionati e mercati
Supporta: Football, Basketball, Tennis, Hockey, Baseball, NFL, MMA, ESports
"""
from flask import Flask, jsonify, request
from flask_cors import CORS
import json
import random
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# ═══════════════════════════════════════════════════════════════════════════
# DATABASE COMPLETO SPORT / CAMPIONATI
# ═══════════════════════════════════════════════════════════════════════════

SPORTS_DATABASE = {
    'football': {
        'name': 'Football',
        'leagues': {
            'italy': ['Serie A', 'Serie B', 'Coppa Italia'],
            'england': ['Premier League', 'Championship', 'FA Cup', 'League Cup'],
            'spain': ['La Liga', 'La Liga 2', 'Copa del Rey'],
            'germany': ['Bundesliga', '2. Bundesliga', 'DFB Pokal'],
            'france': ['Ligue 1', 'Ligue 2', 'Coupe de France'],
            'europe': ['Champions League', 'Europa League', 'Conference League'],
            'international': ['World Cup', 'Euro', 'Copa America', 'Nations League']
        },
        'markets': ['1X2', 'over_under_2_5', 'btts', 'double_chance', 'handicap', 'correct_score', 'first_half', 'draw_no_bet']
    },
    'basketball': {
        'name': 'Basketball',
        'leagues': {
            'usa': ['NBA', 'NCAA'],
            'europe': ['EuroLeague', 'EuroCup'],
            'spain': ['Liga ACB'],
            'italy': ['Lega Basket Serie A'],
            'greece': ['Greek Basket League'],
            'international': ['FIBA World Cup', 'Olympics']
        },
        'markets': ['moneyline', 'spread', 'over_under', 'first_half', 'second_half', 'quarter_1', 'race_to_20']
    },
    'tennis': {
        'name': 'Tennis',
        'leagues': {
            'atp': ['ATP Finals', 'ATP Masters 1000', 'ATP 500', 'ATP 250'],
            'wta': ['WTA Finals', 'WTA 1000', 'WTA 500', 'WTA 250'],
            'grand_slam': ['Australian Open', 'French Open', 'Wimbledon', 'US Open'],
            'davis_cup': ['Davis Cup', 'Billie Jean King Cup']
        },
        'markets': ['match_winner', 'set_1_winner', 'set_2_winner', 'total_games', 'handicap_games', 'correct_score_sets']
    },
    'hockey': {
        'name': 'Ice Hockey',
        'leagues': {
            'usa': ['NHL', 'AHL'],
            'russia': ['KHL'],
            'sweden': ['SHL'],
            'finland': ['Liiga'],
            'czech': ['Extraliga'],
            'germany': ['DEL'],
            'switzerland': ['National League'],
            'international': ['IIHF World Championship', 'Olympics']
        },
        'markets': ['1X2', 'over_under_5_5', 'puck_line', 'first_period', 'correct_score', 'total_goals']
    },
    'baseball': {
        'name': 'Baseball',
        'leagues': {
            'usa': ['MLB', 'MiLB'],
            'japan': ['NPB'],
            'korea': ['KBO'],
            'international': ['World Baseball Classic']
        },
        'markets': ['moneyline', 'run_line', 'over_under', 'first_5_innings', 'total_runs', 'innings_1']
    },
    'americanfootball': {
        'name': 'American Football',
        'leagues': {
            'usa': ['NFL', 'NCAA Football', 'XFL', 'USFL'],
            'canada': ['CFL']
        },
        'markets': ['moneyline', 'spread', 'over_under', 'first_half', 'second_half', 'quarter_1', 'total_touchdowns']
    },
    'mma': {
        'name': 'MMA',
        'leagues': {
            'ufc': ['UFC Fight Night', 'UFC PPV', 'UFC Main Event'],
            'bellator': ['Bellator MMA'],
            'one': ['ONE Championship'],
            'pfl': ['PFL']
        },
        'markets': ['match_winner', 'method_of_victory', 'round_total', 'round_winner', 'fight_go_distance', 'ko_tko', 'submission']
    },
    'boxing': {
        'name': 'Boxing',
        'leagues': {
            'heavyweight': ['WBC', 'WBA', 'IBF', 'WBO'],
            'middleweight': ['WBC', 'WBA', 'IBF', 'WBO'],
            'lightweight': ['WBC', 'WBA', 'IBF', 'WBO'],
            'welterweight': ['WBC', 'WBA', 'IBF', 'WBO']
        },
        'markets': ['match_winner', 'method_of_victory', 'round_total', 'round_group', 'knockout', 'decision', 'draw']
    },
    'esports': {
        'name': 'ESports',
        'leagues': {
            'lol': ['LCK', 'LPL', 'LEC', 'LCS', 'MSI', 'Worlds'],
            'csgo': ['BLAST Premier', 'IEM', 'ESL Pro League', 'Major'],
            'dota2': ['The International', 'DPC', 'ESL One'],
            'valorant': ['VCT', 'Champions', 'Lock In'],
            'rocket_league': ['RLCS', 'RLCS Major'],
            'overwatch': ['OWL', 'OWCS'],
            'rainbow6': ['Six Invitational', 'Pro League'],
            'call_of_duty': ['CDL', 'Call of Duty League']
        },
        'markets': ['match_winner', 'map_1', 'map_2', 'map_3', 'correct_score', 'total_maps', 'handicap_maps', 'first_blood', 'first_tower', 'first_dragon']
    },
    'cricket': {
        'name': 'Cricket',
        'leagues': {
            'international': ['Test Matches', 'ODI', 'T20 International'],
            'ipl': ['IPL'],
            'bbl': ['Big Bash League'],
            'psl': ['Pakistan Super League'],
            'county': ['County Championship'],
            't20_blast': ['T20 Blast']
        },
        'markets': ['match_winner', 'top_batsman', 'top_bowler', 'total_runs', 'total_wickets', 'method_of_dismissal', 'highest_opening_partnership']
    },
    'rugby': {
        'name': 'Rugby',
        'leagues': {
            'england': ['Premiership Rugby', 'Gallagher Premiership'],
            'france': ['Top 14'],
            'ireland': ['United Rugby Championship'],
            'international': ['Six Nations', 'Rugby World Cup', 'The Rugby Championship'],
            'australia': ['Super Rugby Pacific'],
            'new_zealand': ['Super Rugby Pacific']
        },
        'markets': ['match_winner', 'handicap', 'over_under', 'first_try_scorer', 'last_try_scorer', 'total_tries', 'winning_margin']
    },
    'golf': {
        'name': 'Golf',
        'leagues': {
            'pga': ['PGA Tour', 'PGA Championship', 'The Players Championship'],
            'european': ['DP World Tour', 'BMW PGA Championship'],
            'majors': ['The Masters', 'PGA Championship', 'US Open', 'The Open Championship'],
            'lpga': ['LPGA Tour'],
            'liv': ['LIV Golf']
        },
        'markets': ['tournament_winner', 'top_5', 'top_10', 'top_20', 'head_to_head', 'first_round_leader', 'make_cut', 'hole_in_one']
    },
    'formula1': {
        'name': 'Formula 1',
        'leagues': {
            'f1': ['Grand Prix', 'Sprint Race', 'Qualifying', 'Practice'],
            'f2': ['Formula 2'],
            'f3': ['Formula 3']
        },
        'markets': ['race_winner', 'pole_position', 'fastest_lap', 'top_3', 'top_6', 'head_to_head', 'safety_car', 'first_retirement', 'total_finishers']
    },
    'volleyball': {
        'name': 'Volleyball',
        'leagues': {
            'italy': ['SuperLega'],
            'poland': ['PlusLiga'],
            'russia': ['Russian Super League'],
            'turkey': ['Turkish League'],
            'brazil': ['Brazilian Superliga'],
            'international': ['CEV Champions League', 'FIVB World Championship', 'Olympics']
        },
        'markets': ['match_winner', 'set_handicap', 'total_sets', 'set_1_winner', 'set_2_winner', 'correct_score', 'total_points']
    },
    'handball': {
        'name': 'Handball',
        'leagues': {
            'germany': ['Bundesliga'],
            'spain': ['Liga ASOBAL'],
            'france': ['Starligue'],
            'international': ['EHF Champions League', 'World Championship', 'Olympics']
        },
        'markets': ['1X2', 'handicap', 'over_under', 'first_half', 'second_half', 'highest_scoring_half', 'correct_score']
    },
    'cycling': {
        'name': 'Cycling',
        'leagues': {
            'grand_tours': ['Tour de France', 'Giro d\'Italia', 'Vuelta a España'],
            'classics': ['Monument Classics', 'WorldTour'],
            'tour': ['Tour Down Under', 'Paris-Nice', 'Tour de Suisse'],
            'uci': ['UCI World Championships', 'Olympics']
        },
        'markets': ['stage_winner', 'general_classification', 'points_classification', 'mountains_classification', 'young_rider', 'team_classification', 'head_to_head']
    }
}

# Squadre/Atleti di esempio per generare eventi
TEAMS_PLAYERS = {
    'football': {
        'Serie A': ['Juventus', 'AC Milan', 'Inter', 'Napoli', 'Roma', 'Lazio', 'Atalanta', 'Fiorentina', 'Bologna', 'Torino', 'Genoa', 'Sampdoria', 'Sassuolo', 'Udinese', 'Lecce', 'Cagliari', 'Empoli', 'Verona', 'Frosinone', 'Monza'],
        'Premier League': ['Manchester City', 'Arsenal', 'Liverpool', 'Chelsea', 'Manchester United', 'Tottenham', 'Newcastle', 'Aston Villa', 'West Ham', 'Brighton', 'Wolves', 'Everton', 'Brentford', 'Crystal Palace', 'Fulham', 'Burnley', 'Sheffield United', 'Luton', 'Nottingham Forest', 'Bournemouth'],
        'La Liga': ['Real Madrid', 'Barcelona', 'Atletico Madrid', 'Sevilla', 'Real Sociedad', 'Villarreal', 'Betis', 'Athletic Bilbao', 'Valencia', 'Getafe', 'Celta Vigo', 'Osasuna', 'Mallorca', 'Las Palmas', 'Cadiz', 'Almeria', 'Granada', 'Rayo Vallecano', 'Alaves', 'Girona'],
        'Bundesliga': ['Bayern Munich', 'Borussia Dortmund', 'Leverkusen', 'RB Leipzig', 'Union Berlin', 'Freiburg', 'Eintracht Frankfurt', 'Wolfsburg', 'Mönchengladbach', 'Werder Bremen', 'Hoffenheim', 'Heidenheim', 'Augsburg', 'Stuttgart', 'Bochum', 'Mainz', 'Cologne', 'Darmstadt'],
        'Ligue 1': ['PSG', 'Marseille', 'Lyon', 'Monaco', 'Lille', 'Rennes', 'Lens', 'Nice', 'Strasbourg', 'Nantes', 'Reims', 'Montpellier', 'Toulouse', 'Brest', 'Le Havre', 'Metz', 'Clermont', 'Lorient'],
        'Champions League': ['Manchester City', 'Real Madrid', 'Bayern Munich', 'PSG', 'Barcelona', 'Inter', 'Arsenal', 'Dortmund', 'Atletico Madrid', 'RB Leipzig', 'Porto', 'Benfica', 'PSV', 'Feyenoord', 'Copenhagen', 'Lazio', 'Napoli', 'Newcastle', 'Milan', 'Shakhtar', 'Galatasaray', 'Young Boys', 'Antwerp', 'Celtic', 'Real Sociedad', 'Lens', 'Union Berlin', 'Salzburg']
    },
    'basketball': {
        'NBA': ['Los Angeles Lakers', 'Boston Celtics', 'Golden State Warriors', 'Miami Heat', 'Milwaukee Bucks', 'Denver Nuggets', 'Phoenix Suns', 'Philadelphia 76ers', 'Dallas Mavericks', 'Memphis Grizzlies', 'Sacramento Kings', 'New York Knicks', 'Cleveland Cavaliers', 'LA Clippers', 'Atlanta Hawks', 'Brooklyn Nets', 'Toronto Raptors', 'Chicago Bulls', 'Minnesota Timberwolves', 'Oklahoma City Thunder', 'New Orleans Pelicans', 'Utah Jazz', 'Washington Wizards', 'Indiana Pacers', 'Orlando Magic', 'Portland Trail Blazers', 'Charlotte Hornets', 'Houston Rockets', 'Detroit Pistons', 'San Antonio Spurs'],
        'EuroLeague': ['Real Madrid', 'Barcelona', 'Olympiacos', 'Panathinaikos', 'Anadolu Efes', 'Fenerbahce', 'CSKA Moscow', 'Maccabi Tel Aviv', 'Bayern Munich', 'Alba Berlin', 'Virtus Bologna', 'Olimpia Milano', 'Partizan', 'Crvena Zvezda', 'Baskonia', 'Valencia', 'Monaco', 'Lyon-Villeurbanne', 'Zalgiris', 'Buducnost']
    },
    'tennis': {
        'ATP': ['Novak Djokovic', 'Carlos Alcaraz', 'Jannik Sinner', 'Daniil Medvedev', 'Alexander Zverev', 'Rafael Nadal', 'Stefanos Tsitsipas', 'Andrey Rublev', 'Holger Rune', 'Taylor Fritz', 'Casper Ruud', 'Tommy Paul', 'Hubert Hurkacz', 'Alex de Minaur', 'Grigor Dimitrov', 'Karen Khachanov', 'Frances Tiafoe', 'Ben Shelton', 'Sebastian Korda', 'Jack Draper'],
        'WTA': ['Iga Swiatek', 'Aryna Sabalenka', 'Coco Gauff', 'Elena Rybakina', 'Jessica Pegula', 'Marketa Vondrousova', 'Maria Sakkari', 'Ons Jabeur', 'Qinwen Zheng', 'Barbora Krejcikova', 'Jelena Ostapenko', 'Liudmila Samsonova', 'Beatriz Haddad Maia', 'Madison Keys', 'Daria Kasatkina', 'Veronika Kudermetova', 'Karolina Muchova', 'Elise Mertens', 'Danielle Collins', 'Emma Navarro']
    },
    'hockey': {
        'NHL': ['Toronto Maple Leafs', 'Boston Bruins', 'Tampa Bay Lightning', 'Florida Panthers', 'Carolina Hurricanes', 'New York Rangers', 'New Jersey Devils', 'New York Islanders', 'Pittsburgh Penguins', 'Washington Capitals', 'Philadelphia Flyers', 'Columbus Blue Jackets', 'Buffalo Sabres', 'Detroit Red Wings', 'Montreal Canadiens', 'Ottawa Senators', 'Colorado Avalanche', 'Dallas Stars', 'Minnesota Wild', 'Winnipeg Jets', 'Nashville Predators', 'St Louis Blues', 'Arizona Coyotes', 'Chicago Blackhawks', 'Vegas Golden Knights', 'Edmonton Oilers', 'Calgary Flames', 'Los Angeles Kings', 'Seattle Kraken', 'San Jose Sharks', 'Vancouver Canucks', 'Anaheim Ducks']
    },
    'baseball': {
        'MLB': ['New York Yankees', 'Boston Red Sox', 'Toronto Blue Jays', 'Tampa Bay Rays', 'Baltimore Orioles', 'Houston Astros', 'Texas Rangers', 'Seattle Mariners', 'Los Angeles Angels', 'Oakland Athletics', 'Minnesota Twins', 'Cleveland Guardians', 'Chicago White Sox', 'Detroit Tigers', 'Kansas City Royals', 'Atlanta Braves', 'New York Mets', 'Philadelphia Phillies', 'Washington Nationals', 'Miami Marlins', 'Milwaukee Brewers', 'Chicago Cubs', 'Cincinnati Reds', 'Pittsburgh Pirates', 'St Louis Cardinals', 'Los Angeles Dodgers', 'San Diego Padres', 'Arizona Diamondbacks', 'San Francisco Giants', 'Colorado Rockies']
    },
    'americanfootball': {
        'NFL': ['Kansas City Chiefs', 'San Francisco 49ers', 'Baltimore Ravens', 'Detroit Lions', 'Buffalo Bills', 'Philadelphia Eagles', 'Dallas Cowboys', 'Green Bay Packers', 'Miami Dolphins', 'Cleveland Browns', 'Cincinnati Bengals', 'Los Angeles Rams', 'Jacksonville Jaguars', 'New York Jets', 'New Orleans Saints', 'Pittsburgh Steelers', 'Seattle Seahawks', 'Minnesota Vikings', 'Denver Broncos', 'Atlanta Falcons', 'Tennessee Titans', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Tampa Bay Buccaneers', 'Indianapolis Colts', 'Houston Texans', 'Washington Commanders', 'New England Patriots', 'Chicago Bears', 'New York Giants', 'Arizona Cardinals', 'Carolina Panthers']
    },
    'mma': {
        'UFC': ['Jon Jones', 'Islam Makhachev', 'Leon Edwards', 'Alex Pereira', 'Sean Strickland', 'Israel Adesanya', 'Charles Oliveira', 'Alexander Volkanovski', 'Max Holloway', 'Sean O\'Malley', 'Aljamain Sterling', 'Merab Dvalishvili', 'Ilia Topuria', 'Dustin Poirier', 'Justin Gaethje', 'Conor McGregor', 'Khamzat Chimaev', 'Bo Nickal', 'Tom Aspinall', 'Sergei Pavlovich']
    },
    'boxing': {
        'Heavyweight': ['Oleksandr Usyk', 'Tyson Fury', 'Anthony Joshua', 'Deontay Wilder', 'Daniel Dubois', 'Zhilei Zhang', 'Joseph Parker', 'Dillian Whyte', 'Joe Joyce', 'Andy Ruiz Jr'],
        'Middleweight': ['Canelo Alvarez', 'Gennady Golovkin', 'Jermell Charlo', 'Demetrius Andrade', 'Jaime Munguia', 'Chris Eubank Jr', 'Kell Brook', 'Liam Smith']
    },
    'esports': {
        'LoL': ['T1', 'Gen.G', 'JDG', 'BLG', 'G2 Esports', 'Fnatic', 'MAD Lions', 'Cloud9', 'Team Liquid', 'NRG', 'PSG Talon', 'GAM Esports', 'Weibo Gaming', 'LNG Esports', 'Bilibili Gaming', 'Top Esports'],
        'CS2': ['NAVI', 'Vitality', 'FaZe Clan', 'G2 Esports', 'Heroic', 'Cloud9', 'Complexity', 'FURIA', 'ENCE', 'Astralis', 'NIP', 'Virtus.pro', 'Spirit', 'MOUZ', 'BIG', 'fnatic'],
        'Dota 2': ['Team Spirit', 'Gaimin Gladiators', 'LGD Gaming', 'Azure Ray', 'BetBoom Team', 'Tundra Esports', 'Team Secret', 'OG', 'Evil Geniuses', 'PSG.LGD'],
        'Valorant': ['Sentinels', 'Fnatic', 'PRX', 'LOUD', 'DRX', 'Paper Rex', 'Cloud9', 'Leviatan', 'NAVI', 'Gen.G', 'Team Liquid', 'G2 Esports']
    },
    'rugby': {
        'Premiership': ['Leicester Tigers', 'Saracens', 'Exeter Chiefs', 'Bath Rugby', 'Bristol Bears', 'Harlequins', 'Northampton Saints', 'Sale Sharks', 'Gloucester Rugby', 'Newcastle Falcons'],
        'Top 14': ['Toulouse', 'La Rochelle', 'Racing 92', 'Lyon', 'Bordeaux', 'Montpellier', 'Stade Francais', 'Toulon', 'Clermont', 'Castres', 'Bayonne', 'Perpignan', 'Pau', 'Oyonnax'],
        'International': ['New Zealand', 'South Africa', 'Ireland', 'France', 'England', 'Wales', 'Australia', 'Scotland', 'Argentina', 'Japan', 'Italy', 'Fiji', 'Samoa', 'Tonga']
    },
    'cricket': {
        'International': ['Australia', 'India', 'England', 'South Africa', 'New Zealand', 'Pakistan', 'Sri Lanka', 'West Indies', 'Bangladesh', 'Afghanistan'],
        'IPL': ['Chennai Super Kings', 'Mumbai Indians', 'Royal Challengers Bangalore', 'Kolkata Knight Riders', 'Rajasthan Royals', 'Sunrisers Hyderabad', 'Delhi Capitals', 'Punjab Kings', 'Lucknow Super Giants', 'Gujarat Titans']
    },
    'golf': {
        'PGA': ['Scottie Scheffler', 'Rory McIlroy', 'Jon Rahm', 'Viktor Hovland', 'Xander Schauffele', 'Patrick Cantlay', 'Matt Fitzpatrick', 'Max Homa', 'Wyndham Clark', 'Brian Harman'],
        'Majors': ['Scottie Scheffler', 'Brooks Koepka', 'Phil Mickelson', 'Dustin Johnson', 'Collin Morikawa', 'Jordan Spieth', 'Justin Thomas', 'Hideki Matsuyama', 'Will Zalatoris', 'Tommy Fleetwood']
    },
    'formula1': {
        'F1': ['Max Verstappen', 'Sergio Perez', 'Lewis Hamilton', 'George Russell', 'Charles Leclerc', 'Carlos Sainz', 'Lando Norris', 'Oscar Piastri', 'Fernando Alonso', 'Lance Stroll', 'Esteban Ocon', 'Pierre Gasly', 'Alexander Albon', 'Logan Sargeant', 'Nico Hulkenberg', 'Kevin Magnussen', 'Valtteri Bottas', 'Zhou Guanyu', 'Daniel Ricciardo', 'Yuki Tsunoda']
    },
    'volleyball': {
        'SuperLega': ['Cucine Lube Civitanova', 'Sir Safety Susa Perugia', 'Itas Trentino', 'Gas Sales Bluenergy Piacenza', 'Allianz Milano', 'Rana Verona', 'Valsa Group Modena', 'Gioiella Prisma Taranto'],
        'International': ['Poland', 'Italy', 'Brazil', 'USA', 'Russia', 'France', 'Japan', 'Iran', 'Argentina', 'Serbia']
    },
    'handball': {
        'Bundesliga': ['SC Magdeburg', 'THW Kiel', 'Flensburg-Handewitt', 'Rhein-Neckar Löwen', 'MT Melsungen', 'Füchse Berlin', 'SG Flensburg', 'TSV Hannover-Burgdorf'],
        'International': ['Denmark', 'France', 'Sweden', 'Spain', 'Germany', 'Norway', 'Egypt', 'Croatia']
    },
    'cycling': {
        'WorldTour': ['Tadej Pogacar', 'Jonas Vingegaard', 'Remco Evenepoel', 'Wout van Aert', 'Mathieu van der Poel', 'Jasper Philipsen', 'Mads Pedersen', 'Mark Cavendish', 'Primoz Roglic', 'Adam Yates']
    }
}

# ═══════════════════════════════════════════════════════════════════════════
# GENERATORE DI QUOTE
# ═══════════════════════════════════════════════════════════════════════════

def generate_teams_players(sport, league):
    """Genera squadre o giocatori per un evento"""
    if sport in TEAMS_PLAYERS and league in TEAMS_PLAYERS[sport]:
        pool = TEAMS_PLAYERS[sport][league]
        if len(pool) >= 2:
            return random.sample(pool, 2)
    
    # Fallback generico
    return [f'Home Team {random.randint(1,99)}', f'Away Team {random.randint(1,99)}']

def generate_odds(sport, market_type='all'):
    """Genera quote realistiche per ogni sport"""
    odds = {}
    
    if sport == 'football':
        # 1X2
        home_prob = random.uniform(0.25, 0.55)
        draw_prob = random.uniform(0.15, 0.30)
        away_prob = 1 - home_prob - draw_prob
        
        odds['1X2'] = {
            '1': round(1 / (home_prob * 0.95), 2),
            'X': round(1 / (draw_prob * 0.95), 2),
            '2': round(1 / (away_prob * 0.95), 2)
        }
        
        # Over/Under 2.5
        odds['over_under_2_5'] = {
            'Over': round(random.uniform(1.70, 2.20), 2),
            'Under': round(random.uniform(1.70, 2.10), 2)
        }
        
        # BTTS
        odds['btts'] = {
            'Yes': round(random.uniform(1.70, 2.00), 2),
            'No': round(random.uniform(1.75, 2.05), 2)
        }
        
        # Double Chance
        odds['double_chance'] = {
            '1X': round(1 / ((home_prob + draw_prob) * 0.95), 2),
            '12': round(1 / ((home_prob + away_prob) * 0.95), 2),
            'X2': round(1 / ((draw_prob + away_prob) * 0.95), 2)
        }
        
        # Handicap
        odds['handicap_-1'] = {
            'Home -1': round(random.uniform(2.50, 3.50), 2),
            'Away +1': round(random.uniform(1.25, 1.45), 2)
        }
        
        # Correct Score (principali)
        odds['correct_score'] = {
            '1-0': round(random.uniform(6.0, 9.0), 2),
            '2-0': round(random.uniform(7.0, 11.0), 2),
            '2-1': round(random.uniform(7.5, 10.0), 2),
            '0-0': round(random.uniform(7.0, 12.0), 2),
            '1-1': round(random.uniform(6.0, 8.5), 2),
            '0-1': round(random.uniform(7.0, 11.0), 2),
            '0-2': round(random.uniform(9.0, 15.0), 2),
            '1-2': round(random.uniform(8.0, 12.0), 2)
        }
        
        # First Half
        odds['first_half_1x2'] = {
            '1': round(random.uniform(2.20, 3.50), 2),
            'X': round(random.uniform(2.00, 2.60), 2),
            '2': round(random.uniform(3.00, 5.00), 2)
        }
        
    elif sport == 'basketball':
        # Moneyline
        odds['moneyline'] = {
            '1': round(random.uniform(1.40, 2.80), 2),
            '2': round(random.uniform(1.40, 2.80), 2)
        }
        
        # Spread
        spread = random.choice([-7.5, -6.5, -5.5, -4.5, -3.5, 3.5, 4.5, 5.5, 6.5, 7.5])
        odds['spread'] = {
            f'Home {spread}': 1.91,
            f'Away {-spread}': 1.91
        }
        
        # Total
        total = random.choice([210.5, 215.5, 220.5, 225.5, 230.5])
        odds['over_under'] = {
            f'Over {total}': 1.91,
            f'Under {total}': 1.91
        }
        
        # Quarters
        for i in range(1, 5):
            odds[f'quarter_{i}_winner'] = {
                'Home': round(random.uniform(1.70, 2.10), 2),
                'Away': round(random.uniform(1.70, 2.10), 2)
            }
        
        # First Half
        odds['first_half'] = {
            'Home': round(random.uniform(1.60, 2.40), 2),
            'Away': round(random.uniform(1.60, 2.40), 2)
        }
        
        # Race to 20
        odds['race_to_20'] = {
            'Home': round(random.uniform(1.50, 2.10), 2),
            'Away': round(random.uniform(1.70, 2.50), 2)
        }
        
    elif sport == 'tennis':
        # Match Winner
        odds['match_winner'] = {
            '1': round(random.uniform(1.30, 2.50), 2),
            '2': round(random.uniform(1.50, 3.50), 2)
        }
        
        # Set 1 Winner
        odds['set_1_winner'] = {
            '1': round(random.uniform(1.40, 2.20), 2),
            '2': round(random.uniform(1.60, 2.80), 2)
        }
        
        # Total Games
        total = random.choice([20.5, 21.5, 22.5, 23.5])
        odds['total_games'] = {
            f'Over {total}': 1.85,
            f'Under {total}': 1.85
        }
        
        # Handicap Games
        handicap = random.choice([-3.5, -2.5, 2.5, 3.5])
        odds['handicap_games'] = {
            f'Player 1 {handicap}': 1.90,
            f'Player 2 {-handicap}': 1.90
        }
        
        # Correct Score Sets
        odds['correct_score_sets'] = {
            '2-0': round(random.uniform(2.00, 3.50), 2),
            '2-1': round(random.uniform(3.00, 5.00), 2),
            '0-2': round(random.uniform(4.00, 8.00), 2),
            '1-2': round(random.uniform(3.50, 6.00), 2)
        }
        
    elif sport == 'hockey':
        # 1X2 (includes OT)
        odds['1X2'] = {
            '1': round(random.uniform(1.80, 2.60), 2),
            'X': round(random.uniform(3.80, 4.80), 2),
            '2': round(random.uniform(2.20, 3.20), 2)
        }
        
        # Puck Line
        odds['puck_line'] = {
            'Home -1.5': 2.40,
            'Away +1.5': 1.55
        }
        
        # Total
        total = random.choice([5.5, 6.0, 6.5])
        odds['over_under'] = {
            f'Over {total}': 1.85,
            f'Under {total}': 1.85
        }
        
        # First Period
        odds['first_period'] = {
            '1': round(random.uniform(2.20, 3.20), 2),
            'X': round(random.uniform(3.50, 4.50), 2),
            '2': round(random.uniform(2.40, 3.60), 2)
        }
        
    elif sport == 'baseball':
        # Moneyline
        odds['moneyline'] = {
            '1': round(random.uniform(1.50, 2.50), 2),
            '2': round(random.uniform(1.60, 2.80), 2)
        }
        
        # Run Line
        odds['run_line'] = {
            'Home -1.5': 2.10,
            'Away +1.5': 1.70
        }
        
        # Total
        total = random.choice([7.5, 8.0, 8.5, 9.0, 9.5])
        odds['over_under'] = {
            f'Over {total}': 1.90,
            f'Under {total}': 1.90
        }
        
        # First 5 Innings
        odds['first_5_innings'] = {
            'Home': round(random.uniform(1.60, 2.40), 2),
            'Away': round(random.uniform(1.60, 2.40), 2)
        }
        
    elif sport == 'americanfootball':
        # Moneyline
        odds['moneyline'] = {
            '1': round(random.uniform(1.30, 3.50), 2),
            '2': round(random.uniform(1.40, 4.00), 2)
        }
        
        # Spread
        spread = random.choice([-7.0, -6.5, -4.5, -3.0, -2.5, 2.5, 3.0, 4.5, 6.5, 7.0])
        odds['spread'] = {
            f'Home {spread}': 1.91,
            f'Away {-spread}': 1.91
        }
        
        # Total
        total = random.choice([42.5, 44.5, 46.5, 48.5, 50.5])
        odds['over_under'] = {
            f'Over {total}': 1.91,
            f'Under {total}': 1.91
        }
        
        # First Half
        odds['first_half'] = {
            'Home': round(random.uniform(1.50, 2.50), 2),
            'Away': round(random.uniform(1.55, 2.80), 2)
        }
        
        # Total Touchdowns
        odds['total_touchdowns'] = {
            f'Over {random.choice([3.5, 4.5, 5.5])}': 1.85,
            f'Under': 1.85
        }
        
    elif sport == 'mma' or sport == 'boxing':
        # Match Winner
        odds['match_winner'] = {
            'Fighter 1': round(random.uniform(1.40, 3.00), 2),
            'Fighter 2': round(random.uniform(1.60, 3.50), 2)
        }
        
        # Method of Victory
        odds['method_of_victory'] = {
            'KO/TKO': round(random.uniform(2.00, 4.00), 2),
            'Submission': round(random.uniform(4.00, 10.00), 2),
            'Decision': round(random.uniform(2.50, 5.00), 2),
            'Draw': round(random.uniform(15.00, 35.00), 2)
        }
        
        # Round Total
        if sport == 'mma':
            odds['round_total'] = {
                'Over 1.5': 1.70,
                'Under 1.5': 2.10,
                'Over 2.5': 2.20,
                'Under 2.5': 1.65
            }
        else:  # Boxing
            odds['round_total'] = {
                'Over 6.5': 1.75,
                'Under 6.5': 2.05,
                'Over 9.5': 2.40,
                'Under 9.5': 1.55
            }
        
        # Round Winner
        for i in range(1, 6):
            odds[f'round_{i}_winner'] = {
                'Fighter 1': round(random.uniform(6.00, 15.00), 2),
                'Fighter 2': round(random.uniform(7.00, 18.00), 2)
            }
        
        # Fight Goes Distance
        odds['fight_go_distance'] = {
            'Yes': round(random.uniform(1.50, 2.50), 2),
            'No': round(random.uniform(1.50, 2.50), 2)
        }
        
    elif sport == 'esports':
        # Match Winner
        odds['match_winner'] = {
            '1': round(random.uniform(1.40, 2.80), 2),
            '2': round(random.uniform(1.50, 3.20), 2)
        }
        
        # Map Winners
        for i in range(1, 4):
            odds[f'map_{i}_winner'] = {
                '1': round(random.uniform(1.50, 2.40), 2),
                '2': round(random.uniform(1.55, 2.60), 2)
            }
        
        # Total Maps
        odds['total_maps'] = {
            'Over 2.5': 1.95,
            'Under 2.5': 1.80
        }
        
        # Handicap Maps
        odds['handicap_maps'] = {
            'Team 1 -1.5': 2.40,
            'Team 2 +1.5': 1.55
        }
        
        # Correct Score
        odds['correct_score'] = {
            '2-0': 2.20,
            '2-1': 3.00,
            '0-2': 3.50,
            '1-2': 3.20
        }
        
        # Game-specific markets
        if 'LoL' in str(request.args) or True:  # LoL specific
            odds['first_blood'] = {
                'Team 1': round(random.uniform(1.70, 2.10), 2),
                'Team 2': round(random.uniform(1.70, 2.10), 2)
            }
            odds['first_tower'] = {
                'Team 1': round(random.uniform(1.60, 2.00), 2),
                'Team 2': round(random.uniform(1.80, 2.20), 2)
            }
            odds['first_dragon'] = {
                'Team 1': round(random.uniform(1.70, 2.10), 2),
                'Team 2': round(random.uniform(1.70, 2.10), 2)
            }
        
    elif sport == 'cricket':
        # Match Winner
        odds['match_winner'] = {
            '1': round(random.uniform(1.50, 2.50), 2),
            '2': round(random.uniform(1.60, 2.80), 2)
        }
        
        # Top Batsman
        odds['top_batsman'] = {
            'Player 1': round(random.uniform(3.00, 6.00), 2),
            'Player 2': round(random.uniform(3.50, 7.00), 2),
            'Player 3': round(random.uniform(4.00, 8.00), 2),
            'Player 4': round(random.uniform(4.50, 9.00), 2)
        }
        
        # Total Runs
        total = random.choice([280.5, 300.5, 320.5, 340.5])
        odds['total_runs'] = {
            f'Over {total}': 1.85,
            f'Under {total}': 1.85
        }
        
    elif sport == 'rugby':
        # Match Winner
        odds['match_winner'] = {
            '1': round(random.uniform(1.40, 2.80), 2),
            '2': round(random.uniform(1.50, 3.20), 2)
        }
        
        # Handicap
        handicap = random.choice([-7.5, -5.5, -3.5, 3.5, 5.5, 7.5])
        odds['handicap'] = {
            f'Team 1 {handicap}': 1.90,
            f'Team 2 {-handicap}': 1.90
        }
        
        # Total Tries
        total = random.choice([4.5, 5.5, 6.5])
        odds['over_under'] = {
            f'Over {total}': 1.85,
            f'Under {total}': 1.85
        }
        
        # First Try Scorer
        odds['first_try_scorer'] = {
            'Player 1': round(random.uniform(8.00, 15.00), 2),
            'Player 2': round(random.uniform(9.00, 18.00), 2),
            'Player 3': round(random.uniform(10.00, 20.00), 2)
        }
        
    elif sport == 'golf':
        # Tournament Winner
        odds['tournament_winner'] = {
            'Player 1': round(random.uniform(8.00, 25.00), 2),
            'Player 2': round(random.uniform(10.00, 30.00), 2),
            'Player 3': round(random.uniform(12.00, 35.00), 2),
            'Player 4': round(random.uniform(15.00, 45.00), 2),
            'Player 5': round(random.uniform(18.00, 55.00), 2)
        }
        
        # Top 5
        odds['top_5'] = {
            'Player 1': 2.50,
            'Player 2': 2.75,
            'Player 3': 3.00,
            'Player 4': 3.25,
            'Player 5': 3.50
        }
        
        # Top 10
        odds['top_10'] = {
            'Player 1': 1.60,
            'Player 2': 1.70,
            'Player 3': 1.80,
            'Player 4': 1.90,
            'Player 5': 2.00
        }
        
        # Make Cut
        odds['make_cut'] = {
            'Yes': round(random.uniform(1.20, 2.00), 2),
            'No': round(random.uniform(1.80, 5.00), 2)
        }
        
        # First Round Leader
        odds['first_round_leader'] = {
            'Player 1': round(random.uniform(15.00, 40.00), 2),
            'Player 2': round(random.uniform(18.00, 45.00), 2),
            'Player 3': round(random.uniform(20.00, 50.00), 2)
        }
        
        # Head to Head
        odds['head_to_head'] = {
            'Player A': round(random.uniform(1.70, 2.10), 2),
            'Player B': round(random.uniform(1.70, 2.10), 2)
        }
        
    elif sport == 'formula1':
        # Race Winner
        odds['race_winner'] = {
            'Driver 1': round(random.uniform(1.80, 4.00), 2),
            'Driver 2': round(random.uniform(2.50, 6.00), 2),
            'Driver 3': round(random.uniform(4.00, 10.00), 2),
            'Driver 4': round(random.uniform(6.00, 15.00), 2),
            'Driver 5': round(random.uniform(8.00, 25.00), 2)
        }
        
        # Pole Position
        odds['pole_position'] = {
            'Driver 1': round(random.uniform(1.70, 3.50), 2),
            'Driver 2': round(random.uniform(2.20, 5.00), 2),
            'Driver 3': round(random.uniform(3.50, 8.00), 2)
        }
        
        # Fastest Lap
        odds['fastest_lap'] = {
            'Driver 1': round(random.uniform(2.00, 4.50), 2),
            'Driver 2': round(random.uniform(2.50, 6.00), 2),
            'Driver 3': round(random.uniform(3.00, 8.00), 2)
        }
        
        # Top 3
        odds['top_3'] = {
            'Driver 1': round(random.uniform(1.20, 1.80), 2),
            'Driver 2': round(random.uniform(1.30, 2.00), 2),
            'Driver 3': round(random.uniform(1.40, 2.20), 2)
        }
        
        # Safety Car
        odds['safety_car'] = {
            'Yes': round(random.uniform(1.40, 1.80), 2),
            'No': round(random.uniform(2.00, 2.80), 2)
        }
        
    elif sport == 'volleyball':
        # Match Winner
        odds['match_winner'] = {
            '1': round(random.uniform(1.40, 2.80), 2),
            '2': round(random.uniform(1.50, 3.20), 2)
        }
        
        # Set Handicap
        odds['set_handicap'] = {
            'Team 1 -1.5': 2.40,
            'Team 2 +1.5': 1.55
        }
        
        # Total Sets
        odds['total_sets'] = {
            'Over 3.5': 2.10,
            'Under 3.5': 1.70
        }
        
        # Set 1 Winner
        odds['set_1_winner'] = {
            '1': round(random.uniform(1.50, 2.40), 2),
            '2': round(random.uniform(1.55, 2.60), 2)
        }
        
        # Correct Score
        odds['correct_score'] = {
            '3-0': 2.75,
            '3-1': 3.20,
            '3-2': 4.50,
            '0-3': 3.50,
            '1-3': 4.00,
            '2-3': 5.50
        }
        
    elif sport == 'handball':
        # 1X2
        odds['1X2'] = {
            '1': round(random.uniform(1.40, 2.60), 2),
            'X': round(random.uniform(6.00, 9.00), 2),
            '2': round(random.uniform(2.00, 3.20), 2)
        }
        
        # Handicap
        handicap = random.choice([-3.5, -2.5, 2.5, 3.5])
        odds['handicap'] = {
            f'Team 1 {handicap}': 1.90,
            f'Team 2 {-handicap}': 1.90
        }
        
        # Total
        total = random.choice([52.5, 54.5, 56.5, 58.5])
        odds['over_under'] = {
            f'Over {total}': 1.85,
            f'Under {total}': 1.85
        }
        
        # First Half
        odds['first_half'] = {
            '1': round(random.uniform(1.60, 2.40), 2),
            'X': round(random.uniform(4.00, 6.00), 2),
            '2': round(random.uniform(2.20, 3.40), 2)
        }
        
    elif sport == 'cycling':
        # Stage Winner
        odds['stage_winner'] = {
            'Rider 1': round(random.uniform(3.00, 12.00), 2),
            'Rider 2': round(random.uniform(4.00, 15.00), 2),
            'Rider 3': round(random.uniform(5.00, 20.00), 2),
            'Rider 4': round(random.uniform(6.00, 25.00), 2),
            'Rider 5': round(random.uniform(8.00, 35.00), 2)
        }
        
        # General Classification
        odds['general_classification'] = {
            'Rider 1': round(random.uniform(1.80, 4.00), 2),
            'Rider 2': round(random.uniform(2.50, 6.00), 2),
            'Rider 3': round(random.uniform(3.50, 10.00), 2)
        }
        
        # Points Classification
        odds['points_classification'] = {
            'Rider 1': round(random.uniform(2.00, 5.00), 2),
            'Rider 2': round(random.uniform(2.50, 7.00), 2),
            'Rider 3': round(random.uniform(3.00, 10.00), 2)
        }
        
        # Head to Head
        odds['head_to_head'] = {
            'Rider A': round(random.uniform(1.70, 2.10), 2),
            'Rider B': round(random.uniform(1.70, 2.10), 2)
        }
    
    return odds

def generate_events(sport, country, league, count=5):
    """Genera eventi di esempio con quote"""
    events = []
    base_time = datetime.now()
    
    for i in range(count):
        # Genera orario (oggi o domani)
        start_time = base_time + timedelta(hours=random.randint(1, 48))
        
        # Genera squadre/giocatori
        home, away = generate_teams_players(sport, league)
        
        # Genera quote
        odds = generate_odds(sport)
        
        # Stato dell'evento
        status = random.choice(['prematch', 'prematch', 'prematch', 'live'])  # 75% prematch
        
        # Score se live
        score = None
        if status == 'live':
            if sport in ['football', 'hockey']:
                score = {'home': random.randint(0, 3), 'away': random.randint(0, 3)}
            elif sport == 'basketball':
                score = {'home': random.randint(80, 110), 'away': random.randint(80, 110)}
            elif sport == 'tennis':
                score = {'home': random.randint(0, 2), 'away': random.randint(0, 2), 'games': f"{random.randint(0,6)}-{random.randint(0,6)}"}
            elif sport == 'baseball']:
                score = {'home': random.randint(0, 8), 'away': random.randint(0, 8), 'inning': random.randint(1,9)}
            elif sport in ['mma', 'boxing']:
                score = {'round': random.randint(1, 5), 'time': f"{random.randint(0,4)}:{random.randint(0,59):02d}"}
        
        event = {
            'id': f"{sport[:3]}-{country[:3]}-{league[:3]}-{i+1}-{random.randint(1000, 9999)}",
            'sport': sport,
            'country': country,
            'league': league,
            'homeTeam': home,
            'awayTeam': away,
            'startTime': start_time.isoformat(),
            'status': status,
            'score': score,
            'odds': odds,
            'available_markets': list(odds.keys()),
            'market_count': len(odds)
        }
        
        events.append(event)
    
    return events

# ═══════════════════════════════════════════════════════════════════════════
# API ROUTES
# ═══════════════════════════════════════════════════════════════════════════

@app.route('/api/sports')
def get_all_sports():
    """Restituisce tutti gli sport disponibili"""
    sports_list = []
    for sport_id, data in SPORTS_DATABASE.items():
        # Conta totale eventi disponibili
        total_leagues = sum(len(leagues) for leagues in data['leagues'].values())
        
        sports_list.append({
            'id': sport_id,
            'name': data['name'],
            'countries': len(data['leagues']),
            'total_leagues': total_leagues,
            'markets': data['markets'],
            'market_count': len(data['markets'])
        })
    
    return jsonify({
        'success': True,
        'count': len(sports_list),
        'data': sports_list
    })

@app.route('/api/sports/<sport_id>/leagues')
def get_sport_leagues(sport_id):
    """Restituisce tutti i campionati per uno sport"""
    if sport_id not in SPORTS_DATABASE:
        return jsonify({'success': False, 'error': 'Sport not found'}), 404
    
    sport_data = SPORTS_DATABASE[sport_id]
    leagues_list = []
    
    for country, leagues in sport_data['leagues'].items():
        for league in leagues:
            leagues_list.append({
                'country': country,
                'name': league,
                'id': f"{sport_id}-{country}-{league.lower().replace(' ', '_')}"
            })
    
    return jsonify({
        'success': True,
        'sport': sport_id,
        'count': len(leagues_list),
        'data': leagues_list
    })

@app.route('/api/sports/<sport_id>/markets')
def get_sport_markets(sport_id):
    """Restituisce tutti i mercati disponibili per uno sport"""
    if sport_id not in SPORTS_DATABASE:
        return jsonify({'success': False, 'error': 'Sport not found'}), 404
    
    sport_data = SPORTS_DATABASE[sport_id]
    
    return jsonify({
        'success': True,
        'sport': sport_id,
        'count': len(sport_data['markets']),
        'markets': sport_data['markets']
    })

@app.route('/api/events/<sport>/<country>/<league>')
def get_league_events(sport, country, league):
    """Restituisce eventi per una specifica lega"""
    # Normalizza nomi
    sport = sport.lower()
    country = country.lower()
    league_normalized = league.replace('_', ' ').title()
    
    # Verifica sport esista
    if sport not in SPORTS_DATABASE:
        return jsonify({'success': False, 'error': f'Sport {sport} not supported'}), 400
    
    # Parametri opzionali
    count = request.args.get('count', 10, type=int)
    
    # Genera eventi
    events = generate_events(sport, country, league_normalized, count)
    
    return jsonify({
        'success': True,
        'sport': sport,
        'country': country,
        'league': league,
        'count': len(events),
        'timestamp': datetime.now().isoformat(),
        'data': events
    })

@app.route('/api/events/all')
def get_all_events():
    """Restituisce eventi da tutti gli sport e campionati"""
    all_events = []
    max_per_league = request.args.get('max_per_league', 3, type=int)
    
    for sport_id, sport_data in SPORTS_DATABASE.items():
        for country, leagues in sport_data['leagues'].items():
            for league in leagues:
                events = generate_events(sport_id, country, league, max_per_league)
                all_events.extend(events)
    
    # Shuffle per varietà
    random.shuffle(all_events)
    
    # Limita se richiesto
    limit = request.args.get('limit', len(all_events), type=int)
    all_events = all_events[:limit]
    
    return jsonify({
        'success': True,
        'total_events': len(all_events),
        'sports_covered': len(SPORTS_DATABASE),
        'timestamp': datetime.now().isoformat(),
        'data': all_events
    })

@app.route('/api/events/live')
def get_live_events():
    """Restituisce solo eventi live"""
    live_events = []
    
    for sport_id, sport_data in SPORTS_DATABASE.items():
        for country, leagues in sport_data['leagues'].items():
            for league in leagues:
                # Genera 1-2 eventi live per lega
                num_live = random.randint(0, 2)
                if num_live > 0:
                    events = generate_events(sport_id, country, league, num_live)
                    for ev in events:
                        ev['status'] = 'live'
                        # Aggiungi score appropriato
                        if sport_id == 'football':
                            ev['score'] = {'home': random.randint(0, 3), 'away': random.randint(0, 3), 'minute': random.randint(15, 85)}
                        elif sport_id == 'basketball':
                            ev['score'] = {'home': random.randint(60, 110), 'away': random.randint(60, 110), 'quarter': random.randint(1, 4)}
                        elif sport_id == 'tennis':
                            ev['score'] = {'home': random.randint(0, 2), 'away': random.randint(0, 2), 'set_games': f"{random.randint(0,6)}-{random.randint(0,6)}"}
                    live_events.extend(events)
    
    return jsonify({
        'success': True,
        'live_count': len(live_events),
        'timestamp': datetime.now().isoformat(),
        'data': live_events
    })

@app.route('/api/odds/<sport_id>')
def get_sport_odds_template(sport_id):
    """Restituisce template delle quote per uno sport"""
    if sport_id not in SPORTS_DATABASE:
        return jsonify({'success': False, 'error': 'Sport not found'}), 404
    
    # Genera quote di esempio
    odds = generate_odds(sport_id)
    
    return jsonify({
        'success': True,
        'sport': sport_id,
        'markets': list(odds.keys()),
        'market_count': len(odds),
        'odds_example': odds
    })

@app.route('/api/search')
def search_events():
    """Cerca eventi per squadra/giocatore"""
    query = request.args.get('q', '').lower()
    sport_filter = request.args.get('sport', '').lower()
    
    if not query or len(query) < 2:
        return jsonify({'success': False, 'error': 'Query too short'}), 400
    
    results = []
    
    for sport_id, sport_data in SPORTS_DATABASE.items():
        if sport_filter and sport_id != sport_filter:
            continue
            
        for country, leagues in sport_data['leagues'].items():
            for league in leagues:
                # Genera qualche evento e filtra
                events = generate_events(sport_id, country, league, 5)
                for ev in events:
                    if query in ev['homeTeam'].lower() or query in ev['awayTeam'].lower():
                        results.append(ev)
    
    return jsonify({
        'success': True,
        'query': query,
        'results_count': len(results),
        'data': results
    })

@app.route('/api/health')
def health():
    return jsonify({
        'status': 'ok',
        'service': 'complete-sports-api',
        'version': '2.0',
        'sports_available': len(SPORTS_DATABASE),
        'timestamp': datetime.now().isoformat()
    })

@app.route('/')
def index():
    """Pagina informativa"""
    return jsonify({
        'service': 'Complete Sports API',
        'version': '2.0',
        'description': 'Tutti gli sport, tutti i campionati, tutti i mercati',
        'endpoints': [
            'GET /api/sports - Lista tutti gli sport',
            'GET /api/sports/<sport>/leagues - Lista campionati',
            'GET /api/sports/<sport>/markets - Lista mercati',
            'GET /api/events/<sport>/<country>/<league> - Eventi per lega',
            'GET /api/events/all - Tutti gli eventi',
            'GET /api/events/live - Solo eventi live',
            'GET /api/odds/<sport> - Template quote',
            'GET /api/search?q=<query> - Cerca eventi',
            'GET /api/health - Health check'
        ],
        'sports_supported': list(SPORTS_DATABASE.keys()),
        'total_leagues': sum(len(leagues) for sport in SPORTS_DATABASE.values() for leagues in sport['leagues'].values())
    })

if __name__ == '__main__':
    print("╔════════════════════════════════════════════════════════════╗")
    print("║  ⚡ COMPLETE SPORTS API v2.0                              ║")
    print("║  Tutti gli sport, tutti i campionati, tutti i mercati    ║")
    print("║                                                            ║")
    print("║  Sport supportati:                                         ║")
    for sport, data in SPORTS_DATABASE.items():
        leagues_count = sum(len(l) for l in data['leagues'].values())
        print(f"║    • {sport:12} - {leagues_count:2} leghe, {len(data['markets'])} mercati         ║")
    print("║                                                            ║")
    print("║  HTTP → http://localhost:5002                              ║")
    print("╚════════════════════════════════════════════════════════════╝\n")
    
    app.run(host='0.0.0.0', port=5002, debug=True)
