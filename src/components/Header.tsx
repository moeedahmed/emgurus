import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Brain, LogOut, LayoutDashboard, User as UserIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const displayName = (user?.user_metadata?.full_name as string) || (user?.email?.split('@')[0] ?? 'Account');
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center space-x-2 cursor-pointer" onClick={() => navigate('/') }>
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">EMGurus</span>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <button onClick={() => navigate('/')} className="text-muted-foreground hover:text-primary transition-colors">Home</button>
            <button onClick={() => navigate('/blog')} className="text-muted-foreground hover:text-primary transition-colors">Blog</button>
            <button onClick={() => navigate('/quiz')} className="text-muted-foreground hover:text-primary transition-colors">Exams</button>
            <button onClick={() => navigate('/consultations')} className="text-muted-foreground hover:text-primary transition-colors">Consultations</button>
            <button onClick={() => navigate('/forums')} className="text-muted-foreground hover:text-primary transition-colors">Forums</button>
          </nav>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-accent">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.user_metadata?.avatar_url} alt={displayName} />
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground">{displayName}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Account</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                    <LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/auth')}>
                    <UserIcon className="mr-2 h-4 w-4" /> Account
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" onClick={() => navigate('/auth')}>Sign In</Button>
                <Button variant="hero" onClick={() => navigate('/quiz')}>Get Started</Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-foreground" />
            ) : (
              <Menu className="w-6 h-6 text-foreground" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-border">
            <nav className="flex flex-col space-y-4">
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2" onClick={() => {navigate('/'); setIsMenuOpen(false);}}>Home</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2" onClick={() => {navigate('/blog'); setIsMenuOpen(false);}}>Blog</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2" onClick={() => {navigate('/quiz'); setIsMenuOpen(false);}}>Exams</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2" onClick={() => {navigate('/consultations'); setIsMenuOpen(false);}}>Consultations</button>
              <button className="text-left text-muted-foreground hover:text-primary transition-colors py-2" onClick={() => {navigate('/forums'); setIsMenuOpen(false);}}>Forums</button>
              <div className="flex flex-col space-y-2 pt-4">
                {user ? (
                  <>
                    <Button variant="outline" className="justify-start" onClick={() => {navigate('/dashboard'); setIsMenuOpen(false);}}>Dashboard</Button>
                    <div className="text-sm text-muted-foreground px-2 py-1">{user.email}</div>
                    <Button variant="outline" className="justify-start" onClick={signOut}>Sign Out</Button>
                  </>
                ) : (
                  <>
                    <Button variant="ghost" className="justify-start" onClick={() => {navigate('/auth'); setIsMenuOpen(false);}}>Sign In</Button>
                    <Button variant="hero" className="justify-start" onClick={() => {navigate('/quiz'); setIsMenuOpen(false);}}>Get Started</Button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;