"""
SoccerAPI Microservice - Quote reali da bookmaker
Installa: pip install soccerapi flask flask-cors
"""
from flask import Flask, jsonify
from flask_cors import CORS
from soccerapi.api import bet365, Bwin, Unibet
import json

app = Flask(__name__)
CORS(app)  # Permette chiamate dal tuo frontend

def odds_to_json(odds_df):
    """Converte pandas DataFrame in JSON"""
    if odds_df is None or odds_df.empty:
        return []
    return json.loads(odds_df.to_json(orient='records', date_format='iso'))

@app.route('/api/odds/bet365/<country>/<league>')
def get_bet365_odds(country, league):
    """Esempio: /api/odds/bet365/italy/serie_a"""
    try:
        # Mappa nomi comuni a formati soccerapi
        league_map = {
            'serie_a': 'Serie A',
            'premier_league': 'Premier League',
            'la_liga': 'La Liga',
            'bundesliga': 'Bundesliga',
            'ligue_1': 'Ligue 1',
            'champions_league': 'Champions League'
        }
        
        league_name = league_map.get(league, league.replace('_', ' ').title())
        
        # Inizializza API
        api = bet365.Bet365()
        
        # Ottieni quote
        odds = api.odds(country.replace('_', ' '), league_name)
        
        return jsonify({
            'success': True,
            'source': 'bet365',
            'country': country,
            'league': league,
            'data': odds_to_json(odds)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/odds/bwin/<country>/<league>')
def get_bwin_odds(country, league):
    """Quote da Bwin"""
    try:
        api = Bwin.Bwin()
        odds = api.odds(country, league)
        return jsonify({
            'success': True,
            'source': 'bwin',
            'data': odds_to_json(odds)
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/odds/all/<country>/<league>')
def get_all_odds(country, league):
    """Aggrega quote da tutti i bookmaker disponibili"""
    results = {}
    
    bookmakers = [
        ('bet365', bet365.Bet365),
        ('bwin', Bwin.Bwin),
        ('unibet', Unibet.Unibet)
    ]
    
    for name, ApiClass in bookmakers:
        try:
            api = ApiClass()
            odds = api.odds(country, league)
            results[name] = odds_to_json(odds)
        except Exception as e:
            results[name] = {'error': str(e)}
    
    return jsonify({
        'success': True,
        'country': country,
        'league': league,
        'data': results
    })

@app.route('/health')
def health():
    return jsonify({'status': 'ok', 'service': 'soccerapi-bridge'})

if __name__ == '__main__':
    # Porta 5001 per non confliggere con la tua API Node (3001)
    app.run(host='0.0.0.0', port=5001, debug=True)
