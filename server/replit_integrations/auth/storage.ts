import { users, type User, type UpsertUser } from "@shared/models/auth";
import { db } from "../../db";
import { eq } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createEmailUser(userData: {
    email: string;
    passwordHash: string;
    fullName?: string;
    phone?: string;
    accountType?: string;
  }): Promise<User>;
  createPhoneUser(userData: {
    phone: string;
    fullName?: string;
  }): Promise<User>;
  markPhoneVerified(userId: string): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user;
  }

  async createPhoneUser(userData: { phone: string; fullName?: string }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        phone: userData.phone,
        fullName: userData.fullName || null,
        accountType: "customer",
        authProvider: "phone",
        isPhoneVerified: "true",
      })
      .returning();
    return user;
  }

  async markPhoneVerified(userId: string): Promise<void> {
    await db.update(users).set({ isPhoneVerified: "true" }).where(eq(users.id, userId));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async createEmailUser(userData: {
    email: string;
    passwordHash: string;
    fullName?: string;
    phone?: string;
    accountType?: string;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        fullName: userData.fullName,
        phone: userData.phone,
        accountType: userData.accountType || "customer",
        authProvider: "email",
        isEmailVerified: "false",
      })
      .returning();
    return user;
  }
}

export const authStorage = new AuthStorage();
