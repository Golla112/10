import { Request, Response, NextFunction } from 'express';
import { sanitizeInput } from './sanitize';

function makeReq(body: unknown): Request {
  return { body } as Request;
}

const noopRes = {} as Response;
const noopNext: NextFunction = () => {};

describe('sanitizeInput middleware', () => {
  it('strips HTML script tags from string fields', () => {
    const req = makeReq({ name: '<script>alert("xss")</script>hello' });
    sanitizeInput(req, noopRes, noopNext);
    // Tags are removed; inner text content remains
    expect(req.body.name).not.toContain('<script>');
    expect(req.body.name).not.toContain('</script>');
    expect(req.body.name).toContain('hello');
  });

  it('strips arbitrary HTML tags from string fields', () => {
    const req = makeReq({ title: '<b>bold</b> text' });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.title).toBe('bold text');
  });

  it('sanitizes nested objects recursively', () => {
    const req = makeReq({
      user: {
        name: '<em>Alice</em>',
        address: { city: '<span>Rome</span>' },
      },
    });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.user.name).toBe('Alice');
    expect(req.body.user.address.city).toBe('Rome');
  });

  it('sanitizes arrays of strings', () => {
    const req = makeReq({ tags: ['<b>sport</b>', '<i>live</i>', 'clean'] });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.tags).toEqual(['sport', 'live', 'clean']);
  });

  it('passes through numbers unchanged', () => {
    const req = makeReq({ stake: 50, odds: 1.75 });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.stake).toBe(50);
    expect(req.body.odds).toBe(1.75);
  });

  it('passes through booleans unchanged', () => {
    const req = makeReq({ active: true, verified: false });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.active).toBe(true);
    expect(req.body.verified).toBe(false);
  });

  it('strips javascript: protocol from strings', () => {
    const req = makeReq({ url: 'javascript:alert(1)' });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.url).not.toContain('javascript:');
  });

  it('strips javascript: protocol case-insensitively', () => {
    const req = makeReq({ url: 'JAVASCRIPT:alert(1)' });
    sanitizeInput(req, noopRes, noopNext);
    expect(req.body.url).not.toMatch(/javascript:/i);
  });

  it('calls next() after sanitization', () => {
    const next = jest.fn();
    const req = makeReq({ field: 'value' });
    sanitizeInput(req, noopRes, next as NextFunction);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('handles empty body gracefully', () => {
    const req = makeReq({});
    expect(() => sanitizeInput(req, noopRes, noopNext)).not.toThrow();
  });
});
