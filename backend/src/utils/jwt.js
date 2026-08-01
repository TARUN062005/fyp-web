import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export const TOKEN_TYP = {
  MOBILE: 'mobile',
  ADMIN: 'admin',
};

export const generateToken = (payload) => {
  return jwt.sign(
    { ...payload, typ: TOKEN_TYP.MOBILE },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

export const generateRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, typ: TOKEN_TYP.MOBILE },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpiresIn }
  );
};

export const verifyToken = (token) => {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (decoded.typ !== TOKEN_TYP.MOBILE) {
    throw new Error('Not a mobile access token');
  }
  return decoded;
};

export const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, env.jwtRefreshSecret);
  if (decoded.typ !== TOKEN_TYP.MOBILE) {
    throw new Error('Not a mobile refresh token');
  }
  return decoded;
};

export const generateAdminToken = (payload) => {
  return jwt.sign(
    { ...payload, typ: TOKEN_TYP.ADMIN },
    env.adminJwtSecret,
    { expiresIn: env.adminJwtExpiresIn }
  );
};

export const generateAdminRefreshToken = (payload) => {
  return jwt.sign(
    { ...payload, typ: TOKEN_TYP.ADMIN },
    env.adminJwtRefreshSecret,
    { expiresIn: env.adminJwtRefreshExpiresIn }
  );
};

export const verifyAdminToken = (token) => {
  const decoded = jwt.verify(token, env.adminJwtSecret);
  if (decoded.typ !== TOKEN_TYP.ADMIN) {
    throw new Error('Not an admin access token');
  }
  return decoded;
};

export const verifyAdminRefreshToken = (token) => {
  const decoded = jwt.verify(token, env.adminJwtRefreshSecret);
  if (decoded.typ !== TOKEN_TYP.ADMIN) {
    throw new Error('Not an admin refresh token');
  }
  return decoded;
};
