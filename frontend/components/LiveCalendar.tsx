'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { fetchSportEvents } from '../lib/api';

type CalendarEvent = {
  id: string;
  home: string;
  away: string;
  league: string;
  startTime: number;
};

function formatDayLabel(ts: number): string {
  const date = new Date(ts * 1000);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Oggi';
  if (date.toDateString() === tomorrow.toDateString()) return 'Domani';
  return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function LiveCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const { events: raw } = await fetchSportEvents('soccer');
        if (cancelled) return;
        const now = Math.floor(Date.now() / 1000);
        const mapped = raw
          .filter((e) => (e.time ?? 0) >= now - 1800)
          .slice(0, 60)
          .map((e) => ({
            id: e.id,
            home: e.home?.name ?? 'Home',
            away: e.away?.name ?? 'Away',
            league: e.league?.name ?? 'Prematch',
            startTime: e.time ?? now,
          }));
        setEvents(mapped);
        if (mapped.length > 0) {
          setSelectedDay(new Date(mapped[0].startTime * 1000).toDateString());
        }
      } catch {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const days = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = new Date(ev.startTime * 1000).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    }
    return Array.from(map.entries()).map(([date, dayEvents]) => ({
      date,
      label: formatDayLabel(dayEvents[0].startTime),
      events: dayEvents.sort((a, b) => a.startTime - b.startTime),
    }));
  }, [events]);

  const activeDay = days.find((d) => d.date === selectedDay) ?? days[0];

  if (loading) {
    return <div className='sb-mini-panel sb-skeleton' style={{ height: 180 }} />;
  }

  if (days.length === 0) return null;

  return (
    <div className='sb-mini-panel'>
      <h3 className='sb-mini-panel-title'>Prossimi eventi</h3>
      <div className='sb-day-tabs'>
        {days.map((day) => (
          <button
            key={day.date}
            type='button'
            className={`sb-day-tab ${selectedDay === day.date ? 'active' : ''}`}
            onClick={() => setSelectedDay(day.date)}
          >
            {day.label}
            <span className='sb-day-tab-count'>{day.events.length}</span>
          </button>
        ))}
      </div>
      <div className='sb-mini-list'>
        {activeDay?.events.map((event) => (
          <Link key={event.id} href={`/events/${event.id}`} className='sb-mini-list-row'>
            <span className='sb-mini-list-time'>
              {new Date(event.startTime * 1000).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className='sb-mini-list-text'>
              <small>{event.league}</small>
              {event.home} vs {event.away}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
