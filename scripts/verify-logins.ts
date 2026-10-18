import { DEMO_LOGIN_ACCOUNTS, DEMO_LOGIN_PASSWORD } from '../apps/web/src/features/auth/demo/demo-accounts';

async function main() {
  const base = 'http://127.0.0.1:3000/api';
  console.log('Testing authentication for 4 demo accounts against backend API...');

  for (const account of DEMO_LOGIN_ACCOUNTS) {
    const res = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: account.email,
        password: DEMO_LOGIN_PASSWORD,
      }),
    });

    const data = await res.json() as { success: boolean; data?: { user: { email: string; roles: string[]; permissions: string[] } } };
    if (!res.ok || !data.success) {
      console.error(`FAILED login for ${account.email}:`, data);
      process.exit(1);
    }

    console.log(`SUCCESS: ${account.email} (${account.role}) - Logged in with ${data.data?.user.permissions.length} permissions.`);
  }

  console.log('All 4 demo accounts verified successfully!');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
