import { redirect } from 'next/navigation';

export default function DebugLoginPage() {
  redirect('/auth');
}
