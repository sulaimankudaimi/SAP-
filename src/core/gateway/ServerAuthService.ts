/**
 * Server Authentication Adapter
 * Exclusively handles Supabase Auth in server mode inside /src/core/gateway.
 *
 * Maps username -> synthetic email: `${username}@erp.local`
 * Retrieves profiles row, roles row, and role_permissions.
 * Strictly uses anon key and user JWT; never ships service_role.
 */

import { SupabaseGateway } from './SupabaseGateway';
import { getServerUrl, getServerAnonKey, getServerMode } from './ServerGateway';
import type { AuthSession } from '../services/AuthService';
import type { User, Role } from '../../types/models';

let supabaseAuthClient: SupabaseGateway | null = null;

function getAuthGateway(): SupabaseGateway {
  if (!supabaseAuthClient) {
    const url = getServerUrl();
    const key = getServerAnonKey();
    supabaseAuthClient = new SupabaseGateway(url, key);
  }
  return supabaseAuthClient;
}

export class ServerAuthService {
  static isServerMode(): boolean {
    return getServerMode();
  }

  static async login(username: string, password: string): Promise<AuthSession> {
    const cleanUsername = username.trim().toLowerCase();
    const syntheticEmail = `${cleanUsername}@erp.local`;

    const gateway = getAuthGateway();
    const client = gateway.getClient();

    const { data: authData, error: authError } = await client.auth.signInWithPassword({
      email: syntheticEmail,
      password,
    });

    if (authError || !authData.user || !authData.session) {
      throw new Error(
        'اسم المستخدم أو كلمة المرور غير صحيحة، وقد يؤدي تكرار المحاولات إلى قفل الحساب مؤقتاً.'
      );
    }

    const userId = authData.user.id;

    // Fetch user profile from public.profiles
    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error('تعذر تحميل الملف الشخصي للمستخدم من خادم النظام.');
    }

    if (!profile.is_active) {
      throw new Error('حساب المستخدم معطل أو مقفل من قبل إدارة النظام.');
    }

    // Fetch role from public.roles
    const { data: roleRow, error: roleError } = await client
      .from('roles')
      .select('*')
      .eq('code', profile.role_code)
      .maybeSingle();

    if (roleError || !roleRow) {
      throw new Error(`الدور الوظيفي [${profile.role_code}] غير موجود على الخادم.`);
    }

    // Fetch role permissions
    const { data: perms } = await client
      .from('role_permissions')
      .select('*')
      .eq('role_code', profile.role_code);

    const permissionCodes = (perms || []).map(
      (p: { module: string; activity: string }) => `${p.module}_${p.activity.toUpperCase()}`
    );

    const role: Role = {
      id: roleRow.code,
      code: roleRow.code,
      name: roleRow.name,
      description: roleRow.description || '',
      permissionCodes,
      isSystem: Boolean(roleRow.is_system),
      scopeConstraints: {
        plant: Array.isArray(profile.plant_codes) ? profile.plant_codes : [],
      },
    };

    const user: User = {
      id: profile.user_id,
      username: profile.username,
      fullName: profile.full_name,
      roleId: role.id,
      roleCode: role.code,
      companyCode: '1000',
      plantCode: Array.isArray(profile.plant_codes) && profile.plant_codes.length > 0 ? profile.plant_codes[0] : '1100',
      department: 'Operations',
      passwordHash: '',
      passwordSalt: '',
      mustChangePassword: Boolean(profile.must_change_password),
      failedLoginAttempts: 0,
      isLocked: false,
      lastLoginAt: new Date().toISOString(),
      version: 1,
      createdAt: profile.created_at || new Date().toISOString(),
      updatedAt: profile.updated_at || new Date().toISOString(),
      isDeleted: false,
    };

    return {
      user,
      role,
      token: authData.session.access_token,
      expiresAt: (authData.session.expires_at || 0) * 1000 || Date.now() + 12 * 60 * 60 * 1000,
    };
  }

  static async changePassword(newPassword: string): Promise<void> {
    const gateway = getAuthGateway();
    const client = gateway.getClient();

    const { error } = await client.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      throw new Error(`فشل تحديث كلمة المرور على الخادم: ${error.message}`);
    }

    // Update must_change_password to false in profiles
    const { data: session } = await client.auth.getSession();
    if (session.session?.user?.id) {
      await client
        .from('profiles')
        .update({ must_change_password: false, updated_at: new Date().toISOString() })
        .eq('user_id', session.session.user.id);
    }
  }

  static async restoreSession(): Promise<AuthSession | null> {
    try {
      const gateway = getAuthGateway();
      const client = gateway.getClient();

      const { data: authData } = await client.auth.getSession();
      if (!authData.session || !authData.session.user) {
        return null;
      }

      const userId = authData.session.user.id;
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile || !profile.is_active) return null;

      const { data: roleRow } = await client
        .from('roles')
        .select('*')
        .eq('code', profile.role_code)
        .maybeSingle();

      if (!roleRow) return null;

      const { data: perms } = await client
        .from('role_permissions')
        .select('*')
        .eq('role_code', profile.role_code);

      const permissionCodes = (perms || []).map(
        (p: { module: string; activity: string }) => `${p.module}_${p.activity.toUpperCase()}`
      );

      const role: Role = {
        id: roleRow.code,
        code: roleRow.code,
        name: roleRow.name,
        description: roleRow.description || '',
        permissionCodes,
        isSystem: Boolean(roleRow.is_system),
        scopeConstraints: {
          plant: Array.isArray(profile.plant_codes) ? profile.plant_codes : [],
        },
      };

      const user: User = {
        id: profile.user_id,
        username: profile.username,
        fullName: profile.full_name,
        roleId: role.id,
        roleCode: role.code,
        companyCode: '1000',
        plantCode: Array.isArray(profile.plant_codes) && profile.plant_codes.length > 0 ? profile.plant_codes[0] : '1100',
        department: 'Operations',
        passwordHash: '',
        passwordSalt: '',
        mustChangePassword: Boolean(profile.must_change_password),
        failedLoginAttempts: 0,
        isLocked: false,
        lastLoginAt: new Date().toISOString(),
        version: 1,
        createdAt: profile.created_at || new Date().toISOString(),
        updatedAt: profile.updated_at || new Date().toISOString(),
        isDeleted: false,
      };

      return {
        user,
        role,
        token: authData.session.access_token,
        expiresAt: (authData.session.expires_at || 0) * 1000 || Date.now() + 12 * 60 * 60 * 1000,
      };
    } catch {
      return null;
    }
  }

  static async signOut(): Promise<void> {
    try {
      const gateway = getAuthGateway();
      await gateway.getClient().auth.signOut();
    } catch {
      // Ignore
    }
  }
}
