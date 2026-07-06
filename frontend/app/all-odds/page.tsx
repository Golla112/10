'use client';

import { useState, useEffect } from 'react';
import InlineBetSlip from '@/components/InlineBetSlip';

// Database completo con nazioni, campionati e partite reali
const BETTING_DATA = {
  nations: [
    {
      id: 'italy',
      name: '🇮🇹 Italia',
      color: '#0066cc',
      leagues: [
        {
          id: 'serie-a',
          name: 'Serie A',
          badge: 'SA',
          matches: [
            {
              id: 'sa-1',
              homeTeam: 'Napoli',
              awayTeam: 'Milan',
              date: 'Domenica',
              time: '20:45',
              odds: { home: 1.95, draw: 3.40, away: 3.80 }
            },
            {
              id: 'sa-2',
              homeTeam: 'Inter',
              awayTeam: 'Juventus',
              date: 'Domenica',
              time: '18:00',
              odds: { home: 1.85, draw: 3.20, away: 4.10 }
            },
            {
              id: 'sa-3',
              homeTeam: 'Roma',
              awayTeam: 'Lazio',
              date: 'Sabato',
              time: '18:00',
              odds: { home: 2.10, draw: 3.30, away: 3.40 }
            },
            {
              id: 'sa-4',
              homeTeam: 'Atalanta',
              awayTeam: 'Fiorentina',
              date: 'Domenica',
              time: '15:00',
              odds: { home: 1.75, draw: 3.60, away: 4.20 }
            }
          ]
        },
        {
          id: 'serie-b',
          name: 'Serie B',
          badge: 'SB',
          matches: [
            {
              id: 'sb-1',
              homeTeam: 'Bologna',
              awayTeam: 'Parma',
              date: 'Sabato',
              time: '15:00',
              odds: { home: 2.05, draw: 3.25, away: 3.60 }
            },
            {
              id: 'sb-2',
              homeTeam: 'Genoa',
              awayTeam: 'Sampdoria',
              date: 'Domenica',
              time: '12:30',
              odds: { home: 1.90, draw: 3.40, away: 4.00 }
            }
          ]
        }
      ]
    },
    {
      id: 'spain',
      name: '🇪🇸 Spagna',
      color: '#ffb700',
      leagues: [
        {
          id: 'la-liga',
          name: 'La Liga',
          badge: 'LL',
          matches: [
            {
              id: 'll-1',
              homeTeam: 'Real Madrid',
              awayTeam: 'Barcellona',
              date: 'Sabato',
              time: '21:00',
              odds: { home: 1.65, draw: 3.80, away: 4.20 }
            },
            {
              id: 'll-2',
              homeTeam: 'Atletico Madrid',
              awayTeam: 'Sevilla',
              date: 'Domenica',
              time: '18:15',
              odds: { home: 1.85, draw: 3.40, away: 4.10 }
            },
            {
              id: 'll-3',
              homeTeam: 'Valencia',
              awayTeam: 'Athletic Bilbao',
              date: 'Sabato',
              time: '18:00',
              odds: { home: 2.15, draw: 3.30, away: 3.10 }
            }
          ]
        }
      ]
    },
    {
      id: 'germany',
      name: '🇩🇪 Germania',
      color: '#d20614',
      leagues: [
        {
          id: 'bundesliga',
          name: 'Bundesliga',
          badge: 'BL',
          matches: [
            {
              id: 'bl-1',
              homeTeam: 'Bayern Monaco',
              awayTeam: 'Borussia Dortmund',
              date: 'Sabato',
              time: '18:30',
              odds: { home: 1.45, draw: 4.80, away: 5.50 }
            },
            {
              id: 'bl-2',
              homeTeam: 'RB Lipsia',
              awayTeam: 'Bayer Leverkusen',
              date: 'Domenica',
              time: '15:30',
              odds: { home: 2.10, draw: 3.40, away: 3.20 }
            },
            {
              id: 'bl-3',
              homeTeam: 'Borussia Mönchengladbach',
              awayTeam: 'Eintracht Frankfurt',
              date: 'Sabato',
              time: '15:30',
              odds: { home: 1.95, draw: 3.60, away: 3.80 }
            }
          ]
        }
      ]
    },
    {
      id: 'france',
      name: '🇫🇷 Francia',
      color: '#004692',
      leagues: [
        {
          id: 'ligue-1',
          name: 'Ligue 1',
          badge: 'L1',
          matches: [
            {
              id: 'l1-1',
              homeTeam: 'PSG',
              awayTeam: 'Monaco',
              date: 'Domenica',
              time: '21:00',
              odds: { home: 1.35, draw: 5.20, away: 7.80 }
            },
            {
              id: 'l1-2',
              homeTeam: 'Lione',
              awayTeam: 'Marsiglia',
              date: 'Domenica',
              time: '21:00',
              odds: { home: 2.40, draw: 3.10, away: 2.90 }
            },
            {
              id: 'l1-3',
              homeTeam: 'Lille',
              awayTeam: 'Nice',
              date: 'Sabato',
              time: '17:00',
              odds: { home: 1.80, draw: 3.50, away: 4.00 }
            }
          ]
        }
      ]
    },
    {
      id: 'europe',
      name: '🇪🇺 Europa',
      color: '#ff3b30',
      leagues: [
        {
          id: 'champions-league',
          name: 'Champions League',
          badge: 'UCL',
          matches: [
            {
              id: 'ucl-1',
              homeTeam: 'Arsenal',
              awayTeam: 'Bayern Monaco',
              date: 'Oggi',
              time: '21:00',
              odds: { home: 2.10, draw: 3.60, away: 3.20 }
            },
            {
              id: 'ucl-2',
              homeTeam: 'Real Madrid',
              awayTeam: 'Manchester City',
              date: 'Domani',
              time: '21:00',
              odds: { home: 2.15, draw: 3.40, away: 3.10 }
            },
            {
              id: 'ucl-3',
              homeTeam: 'PSG',
              awayTeam: 'Barcellona',
              date: 'Mercoledì',
              time: '21:00',
              odds: { home: 1.90, draw: 3.70, away: 3.80 }
            },
            {
              id: 'ucl-4',
              homeTeam: 'Inter',
              awayTeam: 'Atletico Madrid',
              date: 'Mercoledì',
              time: '18:45',
              odds: { home: 1.70, draw: 3.60, away: 4.50 }
            }
          ]
        },
        {
          id: 'europa-league',
          name: 'Europa League',
          badge: 'UEL',
          matches: [
            {
              id: 'uel-1',
              homeTeam: 'Roma',
              awayTeam: 'Ajax',
              date: 'Giovedì',
              time: '18:45',
              odds: { home: 1.60, draw: 3.80, away: 4.80 }
            },
            {
              id: 'uel-2',
              homeTeam: 'Liverpool',
              awayTeam: 'Atalanta',
              date: 'Giovedì',
              time: '21:00',
              odds: { home: 1.40, draw: 4.50, away: 6.20 }
            }
          ]
        }
      ]
    }
  ]
};

export default function AllOddsPage() {
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  const [expandedNations, setExpandedNations] = useState<string[]>([]);
  const [expandedLeagues, setExpandedLeagues] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'nations' | 'leagues' | 'matches'>('nations');

  const handleOddClick = (matchId: string, betType: 'home' | 'draw' | 'away', odds: number, teams: string) => {
    const betId = `${matchId}-${betType}`;
    
    if (selectedMatches.includes(betId)) {
      setSelectedMatches(prev => prev.filter(id => id !== betId));
    } else {
      setSelectedMatches(prev => [...prev, betId]);
      console.log('Aggiunto alla schedina:', {
        id: betId,
        match: teams,
        betType: betType === 'home' ? '1' : betType === 'draw' ? 'X' : '2',
        odds: odds
      });
    }
  };

  const isOddSelected = (matchId: string, betType: 'home' | 'draw' | 'away') => {
    return selectedMatches.includes(`${matchId}-${betType}`);
  };

  const toggleNation = (nationId: string) => {
    setExpandedNations(prev => 
      prev.includes(nationId) 
        ? prev.filter(id => id !== nationId)
        : [...prev, nationId]
    );
  };

  const toggleLeague = (leagueId: string) => {
    setExpandedLeagues(prev => 
      prev.includes(leagueId) 
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    );
  };

  const selectAllInNation = (nationId: string) => {
    const nation = BETTING_DATA.nations.find(n => n.id === nationId);
    if (!nation) return;
    
    const allMatchIds = nation.leagues.flatMap(league => 
      league.matches.map(match => match.id)
    );
    
    const newSelections = allMatchIds.flatMap(matchId => [
      `${matchId}-home`,
      `${matchId}-draw`, 
      `${matchId}-away`
    ]);
    
    setSelectedMatches(prev => {
      const existing = prev.filter(id => !newSelections.includes(id));
      return [...existing, ...newSelections];
    });
  };

  const selectAllInLeague = (leagueId: string) => {
    const league = BETTING_DATA.nations.flatMap(n => n.leagues).find(l => l.id === leagueId);
    if (!league) return;
    
    const newSelections = league.matches.map(match => `${match.id}-home`);
    
    setSelectedMatches(prev => {
      const existing = prev.filter(id => !newSelections.includes(id));
      return [...existing, ...newSelections];
    });
  };

  const getTotalMatches = () => {
    return BETTING_DATA.nations.reduce((total, nation) => 
      total + nation.leagues.reduce((leagueTotal, league) => 
        leagueTotal + league.matches.length, 0), 0);
  };

  const getTotalSelections = () => selectedMatches.length;

  return (
    <div style={{ 
      display: 'flex', 
      minHeight: 'calc(100vh - 66px)', 
      background: 'linear-gradient(135deg, #0a0e14 0%, #0d1117 50%, #161b22 100%)'
    }}>
      {/* Main Content */}
      <div style={{ 
        flex: 1, 
        minWidth: 0, 
        overflowY: 'auto', 
        background: 'transparent',
        padding: '20px'
      }}>
        {/* Revolutionary Header */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(13,17,23,0.9) 0%, rgba(22,27,34,0.9) 50%, rgba(10,14,20,0.9) 100%)',
          borderBottom: '4px solid #00d4aa',
          borderRadius: '20px',
          padding: '40px',
          marginBottom: '32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)'
        }}>
          {/* Animated Background */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: `
              radial-gradient(circle at 20% 20%, rgba(0,212,170,0.15) 0%, transparent 50%),
              radial-gradient(circle at 80% 80%, rgba(255,59,48,0.1) 0%, transparent 50%),
              radial-gradient(circle at 50% 50%, rgba(0,212,170,0.05) 0%, transparent 70%)
            `,
            animation: 'pulse 4s ease-in-out infinite'
          }} />
          
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #ff3b30 0%, #ff6b6b 100%)',
              color: '#ffffff',
              padding: '12px 24px',
              borderRadius: '12px',
              fontSize: 'clamp(14px, 3vw, 16px)',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '2px',
              marginBottom: '20px',
              boxShadow: '0 8px 24px rgba(255,59,48,0.4)',
              transform: 'translateY(0)',
              transition: 'transform 0.3s ease'
            }}>
              🌟 QUOTE MONDIALI
            </div>
            
            <h1 style={{
              fontSize: 'clamp(40px, 8vw, 72px)',
              fontWeight: 900,
              color: '#ffffff',
              margin: '0 0 20px 0',
              lineHeight: 1,
              textShadow: '0 6px 20px rgba(0,0,0,0.6)',
              background: 'linear-gradient(135deg, #00d4aa 0%, #ffffff 30%, #ff3b30 70%, #ffffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(0,212,170,0.5))'
            }}>
              Centro Scommesse
            </h1>
            
            <p style={{
              fontSize: 'clamp(18px, 3.5vw, 24px)',
              color: '#8aa4b8',
              margin: '0 0 32px 0',
              lineHeight: 1.4,
              fontWeight: 600
            }}>
              Naviga tra nazioni, campionati e partite
            </p>
            
            {/* Mega Stats */}
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '40px',
              flexWrap: 'wrap'
            }}>
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,212,170,0.2) 0%, rgba(0,212,170,0.1) 100%)',
                border: '2px solid #00d4aa',
                borderRadius: '16px',
                padding: '20px 32px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(0,212,170,0.3)'
              }}>
                <div style={{
                  fontSize: 'clamp(32px, 5vw, 48px)',
                  fontWeight: 900,
                  color: '#00d4aa',
                  textShadow: '0 0 20px rgba(0,212,170,0.6)'
                }}>
                  {getTotalMatches()}
                </div>
                <div style={{
                  fontSize: 'clamp(12px, 2.5vw, 14px)',
                  color: '#8aa4b8',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Partite Totali
                </div>
              </div>
              
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,59,48,0.2) 0%, rgba(255,59,48,0.1) 100%)',
                border: '2px solid #ff3b30',
                borderRadius: '16px',
                padding: '20px 32px',
                textAlign: 'center',
                boxShadow: '0 10px 30px rgba(255,59,48,0.3)'
              }}>
                <div style={{
                  fontSize: 'clamp(32px, 5vw, 48px)',
                  fontWeight: 900,
                  color: '#ff3b30',
                  textShadow: '0 0 20px rgba(255,59,48,0.6)'
                }}>
                  {getTotalSelections()}
                </div>
                <div style={{
                  fontSize: 'clamp(12px, 2.5vw, 14px)',
                  color: '#8aa4b8',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '1px'
                }}>
                  Selezioni Attive
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nations View */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
          gap: '24px',
          marginBottom: '32px'
        }}>
          {BETTING_DATA.nations.map(nation => (
            <div key={nation.id} style={{
              background: 'linear-gradient(135deg, rgba(13,17,23,0.95) 0%, rgba(22,27,34,0.95) 100%)',
              border: `3px solid ${nation.color}`,
              borderRadius: '20px',
              padding: '0',
              overflow: 'hidden',
              boxShadow: '0 15px 35px rgba(0,0,0,0.4)',
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}>
              {/* Nation Header */}
              <div 
                onClick={() => toggleNation(nation.id)}
                style={{
                  background: `linear-gradient(135deg, ${nation.color} 0%, ${nation.color}dd 100%)`,
                  padding: '24px',
                  textAlign: 'center',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(255,255,255,0.1)',
                  transform: expandedNations.includes(nation.id) ? 'translateY(0)' : 'translateY(-100%)',
                  transition: 'transform 0.3s ease'
                }} />
                
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{
                    fontSize: 'clamp(24px, 4vw, 32px)',
                    fontWeight: 900,
                    color: '#ffffff',
                    marginBottom: '8px',
                    textShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }}>
                    {nation.name}
                  </div>
                  <div style={{
                    fontSize: 'clamp(14px, 2.5vw, 16px)',
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 600
                  }}>
                    {nation.leagues.length} Campionati • {nation.leagues.reduce((total, league) => total + league.matches.length, 0)} Partite
                  </div>
                </div>
              </div>
              
              {/* Expandable Content */}
              <div style={{
                maxHeight: expandedNations.includes(nation.id) ? '1000px' : '0',
                overflow: 'hidden',
                transition: 'max-height 0.5s ease',
                background: 'rgba(0,0,0,0.2)'
              }}>
                {/* Select All Button */}
                <div style={{ padding: '16px' }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectAllInNation(nation.id);
                    }}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #00d4aa 0%, #00b8a8 100%)',
                      color: '#0a0e14',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '12px',
                      fontSize: 'clamp(12px, 2.5vw, 14px)',
                      fontWeight: 800,
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '1px',
                      boxShadow: '0 6px 20px rgba(0,212,170,0.4)'
                    }}
                  >
                    Seleziona Tutte le Quote
                  </button>
                </div>
                
                {/* Leagues */}
                <div style={{ padding: '0 16px 16px' }}>
                  {nation.leagues.map(league => (
                    <div key={league.id} style={{
                      background: 'rgba(255,255,255,0.05)',
                      borderRadius: '12px',
                      padding: '16px',
                      marginBottom: '12px',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '12px'
                      }}>
                        <div style={{
                          fontSize: 'clamp(16px, 3vw, 18px)',
                          fontWeight: 700,
                          color: '#ffffff'
                        }}>
                          {league.badge} {league.name}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            selectAllInLeague(league.id);
                          }}
                          style={{
                            background: 'rgba(0,212,170,0.2)',
                            color: '#00d4aa',
                            border: '1px solid #00d4aa',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: 'clamp(10px, 2vw, 12px)',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textTransform: 'uppercase'
                          }}
                        >
                          Seleziona {league.matches.length}
                        </button>
                      </div>
                      
                      {/* Matches */}
                      <div style={{
                        display: 'grid',
                        gap: '8px'
                      }}>
                        {league.matches.map(match => (
                          <div key={match.id} style={{
                            background: 'rgba(0,0,0,0.2)',
                            borderRadius: '8px',
                            padding: '12px',
                            border: '1px solid rgba(255,255,255,0.05)'
                          }}>
                            <div style={{
                              fontSize: 'clamp(12px, 2.5vw, 14px)',
                              color: '#ffffff',
                              fontWeight: 600,
                              marginBottom: '8px',
                              textAlign: 'center'
                            }}>
                              {match.homeTeam} vs {match.awayTeam}
                            </div>
                            <div style={{
                              fontSize: 'clamp(10px, 2vw, 11px)',
                              color: '#8aa4b8',
                              marginBottom: '8px',
                              textAlign: 'center'
                            }}>
                              {match.date} • {match.time}
                            </div>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gap: '6px'
                            }}>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOddClick(match.id, 'home', match.odds.home, `${match.homeTeam} vs ${match.awayTeam}`);
                                }}
                                style={{
                                  background: isOddSelected(match.id, 'home') ? '#00d4aa' : 'rgba(0,212,170,0.1)',
                                  color: isOddSelected(match.id, 'home') ? '#0a0e14' : '#00d4aa',
                                  border: isOddSelected(match.id, 'home') ? 'none' : '1px solid #00d4aa',
                                  borderRadius: '6px',
                                  padding: '8px 4px',
                                  fontSize: 'clamp(10px, 2vw, 11px)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textAlign: 'center'
                                }}
                              >
                                <div style={{ fontSize: 'clamp(9px, 1.8vw, 10px)' }}>
                                  1
                                </div>
                                <div style={{ fontSize: 'clamp(12px, 2.2vw, 14px)', fontWeight: 900 }}>
                                  {match.odds.home}
                                </div>
                              </button>
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOddClick(match.id, 'draw', match.odds.draw, `${match.homeTeam} vs ${match.awayTeam}`);
                                }}
                                style={{
                                  background: isOddSelected(match.id, 'draw') ? '#ff3b30' : 'rgba(255,59,48,0.1)',
                                  color: isOddSelected(match.id, 'draw') ? '#ffffff' : '#ff3b30',
                                  border: isOddSelected(match.id, 'draw') ? 'none' : '1px solid #ff3b30',
                                  borderRadius: '6px',
                                  padding: '8px 4px',
                                  fontSize: 'clamp(10px, 2vw, 11px)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textAlign: 'center'
                                }}
                              >
                                <div style={{ fontSize: 'clamp(9px, 1.8vw, 10px)' }}>
                                  X
                                </div>
                                <div style={{ fontSize: 'clamp(12px, 2.2vw, 14px)', fontWeight: 900 }}>
                                  {match.odds.draw}
                                </div>
                              </button>
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOddClick(match.id, 'away', match.odds.away, `${match.homeTeam} vs ${match.awayTeam}`);
                                }}
                                style={{
                                  background: isOddSelected(match.id, 'away') ? '#00d4aa' : 'rgba(0,212,170,0.1)',
                                  color: isOddSelected(match.id, 'away') ? '#0a0e14' : '#00d4aa',
                                  border: isOddSelected(match.id, 'away') ? 'none' : '1px solid #00d4aa',
                                  borderRadius: '6px',
                                  padding: '8px 4px',
                                  fontSize: 'clamp(10px, 2vw, 11px)',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  textAlign: 'center'
                                }}
                              >
                                <div style={{ fontSize: 'clamp(9px, 1.8vw, 10px)' }}>
                                  2
                                </div>
                                <div style={{ fontSize: 'clamp(12px, 2.2vw, 14px)', fontWeight: 900 }}>
                                  {match.odds.away}
                                </div>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Sidebar - Bet Slip */}
      <aside style={{ 
        width: 'clamp(280px, 25vw, 320px)', 
        flexShrink: 0, 
        background: '#0d1117', 
        borderLeft: '1px solid #1a2535',
        display: 'flex',
        flexDirection: 'column',
        position: 'sticky',
        top: 66,
        height: 'calc(100vh - 66px)'
      }}>
        <InlineBetSlip />
      </aside>
    </div>
  );
}
