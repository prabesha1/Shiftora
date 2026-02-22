import { ArrowRight, Calendar, RefreshCw, DollarSign, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

type Props = {
  onNavigate: (page: string) => void;
};

export function LandingPage({ onNavigate }: Props) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl tracking-tight">
              <span className="font-semibold text-[#2563EB]">Shift</span><span className="text-black">ora</span>
            </span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Features</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">How it works</a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => onNavigate('login')}
              className="rounded-full"
            >
              Log in
            </Button>
            <Button 
              onClick={() => onNavigate('login')}
              className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]"
            >
              Get started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              <span className="px-2 py-0.5 bg-blue-600 text-white rounded-full text-xs">New</span>
              <span className="text-sm">Daily wages & tips report for managers.</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl tracking-tight">
              Simple shift management for small restaurants.
            </h1>
            
            <p className="text-xl text-gray-600 max-w-lg">
              Shift Up helps small restaurants manage shifts, swaps, and daily wages & tips. 
              Built for teams that need clarity and simplicity.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Button 
                size="lg"
                onClick={() => onNavigate('login')}
                className="rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]"
              >
                Start managing shifts
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <Button 
                size="lg"
                variant="ghost"
                className="rounded-full"
              >
                See how it works
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8 border border-gray-100">
            <div className="space-y-1 mb-6">
              <h3 className="text-gray-900">Dashboard overview</h3>
              <p className="text-sm text-gray-500">Real-time insights at a glance</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-2xl p-6 border border-blue-100">
                <div className="text-3xl mb-2">12</div>
                <div className="text-sm text-gray-600">Shifts today</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-2xl p-6 border border-green-100">
                <div className="text-3xl mb-2">8</div>
                <div className="text-sm text-gray-600">Employees</div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-2xl p-6 border border-purple-100">
                <div className="text-3xl mb-2">$2,840</div>
                <div className="text-sm text-gray-600">Total wages</div>
              </div>
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-2xl p-6 border border-amber-100">
                <div className="text-3xl mb-2">$640</div>
                <div className="text-sm text-gray-600">Tips pooled</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl mb-4">Everything you need</h2>
          <p className="text-xl text-gray-600">Powerful features designed for small restaurant teams</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="text-xl">Smart scheduling</h3>
            <p className="text-gray-600">
              Create conflict-free weekly schedules. Automatically check for overlaps and ensure coverage across all shifts.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-green-100 flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-xl">Shift swaps</h3>
            <p className="text-gray-600">
              Employees can request shift swaps with a reason. Managers review and approve or decline in one tap.
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="text-xl">Daily wages & tips</h3>
            <p className="text-gray-600">
              Get a complete breakdown of hours worked, wages earned, and tips collected. Export reports with one click.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl mb-4">How it works</h2>
          <p className="text-xl text-gray-600">Get started in three simple steps</p>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 flex items-start gap-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              1
            </div>
            <div>
              <h3 className="text-xl mb-2">Manager creates schedule</h3>
              <p className="text-gray-600">
                Set up your weekly schedule with drag-and-drop simplicity. Assign roles, times, and employees in minutes.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 flex items-start gap-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              2
            </div>
            <div>
              <h3 className="text-xl mb-2">Staff see shifts and request swaps</h3>
              <p className="text-gray-600">
                Employees log in to view their upcoming shifts. If they can't make it, they submit a swap request with a reason.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-8 shadow-lg shadow-gray-200/50 border border-gray-100 flex items-start gap-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              3
            </div>
            <div>
              <h3 className="text-xl mb-2">Manager runs daily wages & tips report</h3>
              <p className="text-gray-600">
                At the end of each day, generate a complete report showing hours, wages, and tips. Export to CSV or print.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-5xl mx-auto px-6 py-20">
        <div className="text-center mb-12">
          <h2 className="text-4xl mb-4">Simple pricing</h2>
          <p className="text-xl text-gray-600">Free for all teams, up to 200 employees</p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-blue-200/50 border-2 border-blue-200 space-y-6">
            <div>
              <h3 className="text-2xl mb-2">Shift Up</h3>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl">$0</span>
                <span className="text-gray-500">/forever</span>
              </div>
            </div>
            
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">Up to 200 employees</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">Smart scheduling with conflict detection</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">Unlimited shift swaps</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">Daily wages & tips reports</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">Export & print reports</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <div className="w-2 h-2 bg-white rounded-full" />
                </div>
                <span className="text-gray-600">All features included</span>
              </li>
            </ul>

            <Button className="w-full rounded-full bg-[#2563EB] hover:bg-[#1d4ed8]" onClick={() => onNavigate('login')}>
              Get started for free
              <ChevronRight className="ml-2 w-4 h-4" />
            </Button>

            <div className="text-center text-sm text-gray-500 pt-2">
              No credit card required. Free forever.
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-gray-600">
          © 2025 Shiftora by T38. Built for small restaurant teams.
        </div>
      </footer>
    </div>
  );
}