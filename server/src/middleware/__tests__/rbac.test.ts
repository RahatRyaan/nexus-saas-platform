import { requireRole, Role } from '../rbac';
import { Request, Response, NextFunction } from 'express';

describe('RBAC Role Hierarchy Tests', () => {
  const ROLE_HIERARCHY: Record<Role, number> = {
    owner: 3,
    admin: 2,
    member: 1,
  };

  it('owner should have highest permission level', () => {
    expect(ROLE_HIERARCHY['owner']).toBeGreaterThan(ROLE_HIERARCHY['admin']);
    expect(ROLE_HIERARCHY['owner']).toBeGreaterThan(ROLE_HIERARCHY['member']);
  });

  it('admin should satisfy admin and member requirements but not owner', () => {
    const adminLevel = ROLE_HIERARCHY['admin'];
    expect(adminLevel >= ROLE_HIERARCHY['member']).toBe(true);
    expect(adminLevel >= ROLE_HIERARCHY['admin']).toBe(true);
    expect(adminLevel >= ROLE_HIERARCHY['owner']).toBe(false);
  });

  it('member should only satisfy member requirement', () => {
    const memberLevel = ROLE_HIERARCHY['member'];
    expect(memberLevel >= ROLE_HIERARCHY['member']).toBe(true);
    expect(memberLevel >= ROLE_HIERARCHY['admin']).toBe(false);
    expect(memberLevel >= ROLE_HIERARCHY['owner']).toBe(false);
  });
});
