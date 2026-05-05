export interface AuthSessionUser {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	createdAt: string | Date;
	updatedAt: string | Date;
	username?: string | null;
	displayUsername?: string | null;
	image?: string | null;
	mustChangePassword?: boolean;
	passwordChangedAt?: string | Date | null;
	role?: string | null;
	banned?: boolean;
	banReason?: string | null;
	banExpires?: Date | null;
}

export interface AuthSessionRecord {
	id: string;
	userId: string;
	expiresAt: string | Date;
	createdAt?: string | Date;
	updatedAt?: string | Date;
	token?: string;
	ipAddress?: string | null;
	userAgent?: string | null;
}

export interface AuthSessionData {
	user: AuthSessionUser;
	session: AuthSessionRecord;
}
