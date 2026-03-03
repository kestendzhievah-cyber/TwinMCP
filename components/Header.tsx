import Link from "next/link";

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-gray-900">TwinMCP</h1>
          </div>
          <nav className="flex space-x-8">
            <Link href="/" className="text-gray-500 hover:text-gray-900">
              Accueil
            </Link>
            <Link
              href="/dashboard"
              className="text-gray-500 hover:text-gray-900"
            >
              Dashboard
            </Link>
            <Link
              href="/pricing"
              className="text-gray-500 hover:text-gray-900"
            >
              Tarifs
            </Link>
            <Link
              href="/contact"
              className="text-gray-500 hover:text-gray-900"
            >
              Contact
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
