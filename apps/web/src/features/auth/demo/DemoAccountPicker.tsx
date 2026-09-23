import { ROLE_NAMES } from '@blood/shared-types';
import { DEMO_LOGIN_ACCOUNTS, DEMO_LOGIN_PASSWORD } from './demo-accounts';
import './demo-login.css';

export default function DemoAccountPicker({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (credentials: { email: string; password: string }) => void;
}) {
  const mock = import.meta.env.VITE_USE_MOCK_API === 'true';
  return (
    <details className="demo-login">
      <summary>Tài khoản demo</summary>
      <p className="demo-login__hint">
        Chọn vai trò để điền thông tin, sau đó nhấn Đăng nhập.
      </p>
      <div className="demo-login__choices">
        {DEMO_LOGIN_ACCOUNTS.map((account) => (
          <button
            type="button"
            key={account.role}
            disabled={disabled}
            onClick={() =>
              onSelect({
                email: mock ? account.mockEmail : account.email,
                password: mock ? 'Blood@123' : DEMO_LOGIN_PASSWORD,
              })
            }
          >
            {ROLE_NAMES[account.role]}
          </button>
        ))}
      </div>
      <p className="demo-login__hint">
        Chỉ dùng để thử nghiệm trên môi trường phát triển.
      </p>
    </details>
  );
}
