export interface JwtPayload {
  sub: number; // userId
  email: string;
  role: string;
  companyId: number;
}

export interface CurrentUserPayload {
  userId: number;
  email: string;
  role: string;
  companyId: number;
}
