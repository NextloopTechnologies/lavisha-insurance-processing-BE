export interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  access_token: string;
}
