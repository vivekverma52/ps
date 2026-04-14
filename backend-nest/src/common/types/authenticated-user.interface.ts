export interface AuthenticatedUser {
  type: 'USER';
  userId: string;
  name: string;
  email: string;
  role: string;
  baseRole: string;
  orgId: string | null;
  hospitalId: string | null;
  isOrgAdmin: boolean;
  customRoleId: string | null;
}
