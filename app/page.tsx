import { redirect } from 'next/navigation';

export default function Home() {
  // The admin project is dashboard-only now — the public marketing website
  // lives in its own project (bluebellschool-website). Root goes to admin login.
  redirect('/login');
}
