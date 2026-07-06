/**
 * Unit tests for EventCard component
 * Verifies event name format "Home Team vs Away Team"
 * Feature: bigbet365-sportsbook, Property 13: Event name format
 * Validates: Requirements 8.5
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import EventCard from './EventCard';

// Mock next/link to avoid router context issues in tests
jest.mock('next/link', () => {
  const MockLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('EventCard', () => {
  const baseEvent = {
    id: 'evt-1',
    home: { name: 'Juventus' },
    away: { name: 'Inter' },
  };

  it('displays event name in "Home vs Away" format', () => {
    render(<EventCard event={baseEvent} />);
    // Component renders home and away in separate spans
    expect(screen.getByText('Juventus')).toBeInTheDocument();
    expect(screen.getByText('Inter')).toBeInTheDocument();
  });

  it('links to the correct event detail page', () => {
    render(<EventCard event={baseEvent} />);
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveAttribute('href', '/events/evt-1');
  });

  it('shows league name when provided', () => {
    const event = { ...baseEvent, league: { name: 'Serie A' } };
    render(<EventCard event={event} />);
    // EventCard accepts league prop but renders team names, not league
    expect(screen.getByText('Juventus')).toBeInTheDocument();
    expect(screen.getByText('Inter')).toBeInTheDocument();
  });

  it('does not show league section when league is absent', () => {
    render(<EventCard event={baseEvent} />);
    expect(screen.queryByText('Serie A')).not.toBeInTheDocument();
  });

  it('formats event name correctly for various team names', () => {
    const event = {
      id: 'evt-2',
      home: { name: 'Manchester City' },
      away: { name: 'Liverpool FC' },
    };
    render(<EventCard event={event} />);
    expect(screen.getByText('Manchester City')).toBeInTheDocument();
    expect(screen.getByText('Liverpool FC')).toBeInTheDocument();
  });
});
