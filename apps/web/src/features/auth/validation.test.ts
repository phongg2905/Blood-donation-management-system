import { describe, expect, it } from 'vitest';
import {
  PASSWORD_MIN_LENGTH,
  hasErrors,
  isPasswordStrong,
  normalizeEmail,
  pickFieldErrors,
  validateForgotPassword,
  validateLogin,
  validateProfile,
  validateRegister,
  validateResetPassword,
} from './validation';

const VALID_PASSWORD = 'Blood@123';

describe('validateLogin', () => {
  it('accepts a valid email and password', () => {
    const errors = validateLogin({
      email: 'donor@example.local',
      password: 'anything',
    });
    expect(hasErrors(errors)).toBe(false);
  });

  it('requires both fields', () => {
    const errors = validateLogin({ email: '', password: '' });
    expect(errors.email).toBeDefined();
    expect(errors.password).toBeDefined();
  });

  it('rejects a malformed email', () => {
    expect(
      validateLogin({ email: 'khong-phai-email', password: 'x' }).email,
    ).toBe('Email không hợp lệ.');
  });
});

describe('validateRegister', () => {
  const base = {
    fullName: 'Nguyễn Văn A',
    email: 'new@example.local',
    password: VALID_PASSWORD,
    confirmPassword: VALID_PASSWORD,
    acceptTerms: true,
  };

  it('accepts a complete form', () => {
    expect(hasErrors(validateRegister(base))).toBe(false);
  });

  it('requires the full name', () => {
    expect(
      validateRegister({ ...base, fullName: '  ' }).fullName,
    ).toBeDefined();
  });

  it('requires the password to be long enough', () => {
    const errors = validateRegister({
      ...base,
      password: 'a1'.repeat(2),
      confirmPassword: 'a1'.repeat(2),
    });
    expect(errors.password).toContain(String(PASSWORD_MIN_LENGTH));
  });

  it('requires a digit, lowercase and uppercase character in the password', () => {
    expect(
      validateRegister({
        ...base,
        password: 'a'.repeat(10),
        confirmPassword: 'a'.repeat(10),
      }).password,
    ).toContain('chữ số');
    expect(
      validateRegister({
        ...base,
        password: '12345678',
        confirmPassword: '12345678',
      }).password,
    ).toContain('chữ thường');
    expect(
      validateRegister({
        ...base,
        password: 'lowercase1',
        confirmPassword: 'lowercase1',
      }).password,
    ).toContain('chữ hoa');
  });

  it('rejects a mismatched confirmation', () => {
    expect(
      validateRegister({ ...base, confirmPassword: 'Khac@123' })
        .confirmPassword,
    ).toBe('Mật khẩu nhập lại không khớp.');
  });

  it('requires accepting the terms', () => {
    expect(
      validateRegister({ ...base, acceptTerms: false }).acceptTerms,
    ).toBeDefined();
  });
});

describe('validateForgotPassword', () => {
  it('requires a valid email', () => {
    expect(validateForgotPassword({ email: '' }).email).toBeDefined();
    expect(validateForgotPassword({ email: 'ok@example.local' })).toEqual({});
  });
});

describe('validateResetPassword', () => {
  it('rejects a mismatch', () => {
    const errors = validateResetPassword({
      password: VALID_PASSWORD,
      confirmPassword: 'Khac@123',
    });
    expect(errors.confirmPassword).toBe('Mật khẩu nhập lại không khớp.');
  });

  it('accepts matching strong passwords', () => {
    expect(
      hasErrors(
        validateResetPassword({
          password: VALID_PASSWORD,
          confirmPassword: VALID_PASSWORD,
        }),
      ),
    ).toBe(false);
  });
});

describe('password requirements', () => {
  it('enforces the backend maximum of 128 characters', () => {
    expect(isPasswordStrong('Aa1' + 'x'.repeat(125))).toBe(true);
    const password = 'Aa1' + 'x'.repeat(126);
    expect(isPasswordStrong(password)).toBe(false);
    expect(
      validateResetPassword({ password, confirmPassword: password }).password,
    ).toContain('128');
  });

  it('accepts a password that meets every rule', () => {
    expect(isPasswordStrong(VALID_PASSWORD)).toBe(true);
  });

  it('rejects a short password', () => {
    expect(isPasswordStrong('a1')).toBe(false);
  });

  it('requires both lowercase and uppercase characters like the backend', () => {
    expect(isPasswordStrong('lowercase1')).toBe(false);
    expect(isPasswordStrong('UPPERCASE1')).toBe(false);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Donor@Example.Local ')).toBe(
      'donor@example.local',
    );
  });
});

describe('validateProfile', () => {
  it('matches the backend full name bounds of 1 to 200 trimmed characters', () => {
    expect(validateProfile({ fullName: ' A ' })).toEqual({});
    expect(validateProfile({ fullName: 'A'.repeat(200) })).toEqual({});
    expect(validateProfile({ fullName: '  ' }).fullName).toBeDefined();
    expect(validateProfile({ fullName: 'A'.repeat(201) }).fullName).toContain(
      '200',
    );
  });

  it('validates DONOR contact fields against the backend bounds', () => {
    expect(
      validateProfile({ fullName: 'A', phone: '0901234567', address: 'Q.1' }),
    ).toEqual({});
    expect(
      validateProfile({ fullName: 'A', phone: '0901234567', address: 'x' }),
    ).toEqual({});
    expect(
      validateProfile({ fullName: 'A', phone: '0123456', address: 'Địa chỉ' })
        .phone,
    ).toContain('8–20');
    expect(
      validateProfile({ fullName: 'A', phone: '0'.repeat(21), address: '' })
        .phone,
    ).toContain('8–20');
    expect(
      validateProfile({
        fullName: 'A',
        phone: '0901234567',
        address: 'x'.repeat(501),
      }).address,
    ).toContain('500');
    expect(
      validateProfile({ fullName: 'A', phone: '   ', address: '  ' }).phone,
    ).toBeDefined();
  });

  it('skips contact validation when the form does not show those fields', () => {
    // STAFF/ADMIN profile sends only fullName.
    expect(validateProfile({ fullName: 'A' })).toEqual({});
  });
});

describe('pickFieldErrors', () => {
  it('keeps only the fields the form owns', () => {
    const picked = pickFieldErrors(
      { email: 'Email đã tồn tại', other: 'ignored' },
      ['email', 'password'] as const,
    );
    expect(picked).toEqual({ email: 'Email đã tồn tại' });
  });

  it('returns an empty object for null', () => {
    expect(pickFieldErrors(null, ['email'] as const)).toEqual({});
  });
});
