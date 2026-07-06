import { Request, Response, NextFunction } from 'express';
import { passwordCheck } from './passwordCheck';

function makeReq(headers: Record<string, string> = {}, method = 'GET', path = '/private'): Request {
  return { headers, method, path } as unknown as Request;
}

function makeRes(): { status: jest.Mock; json: jest.Mock; statusCode?: number } {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  };
  res.status.mockReturnValue(res);
  return res;
}

describe('passwordCheck middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('allows public GET /events without password', () => {
    process.env.SITE_PASSWORD = 'secret';
    const req = makeReq({}, 'GET', '/events');
    const res = makeRes();
    const next = jest.fn();

    passwordCheck(req, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when no password header is provided', () => {
    process.env.SITE_PASSWORD = 'secret';
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    passwordCheck(req, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when wrong password is provided', () => {
    process.env.SITE_PASSWORD = 'secret';
    const req = makeReq({ 'x-site-password': 'wrong' });
    const res = makeRes();
    const next = jest.fn();

    passwordCheck(req, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when correct password is provided', () => {
    process.env.SITE_PASSWORD = 'secret';
    const req = makeReq({ 'x-site-password': 'secret' });
    const res = makeRes();
    const next = jest.fn();

    passwordCheck(req, res as unknown as Response, next as NextFunction);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 500 when SITE_PASSWORD env var is not set', () => {
    delete process.env.SITE_PASSWORD;
    const req = makeReq({ 'x-site-password': 'anything' });
    const res = makeRes();
    const next = jest.fn();

    passwordCheck(req, res as unknown as Response, next as NextFunction);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'Server misconfigured: SITE_PASSWORD not set' });
    expect(next).not.toHaveBeenCalled();
  });
});
