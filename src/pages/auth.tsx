import { AuthForm } from '../components/auth/auth-form';
import { useAuthStore } from '../store/auth';
import { Navigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

export function AuthPage() {
  const { isAuthenticated } = useAuthStore();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    // Get logo from Supabase storage
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl('logo-transparent.png');
      
    setLogoUrl(publicUrl);
  }, []);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="mb-8 text-center">
        {logoUrl && (
          <img 
            src={logoUrl}
            alt="CMC Social" 
            className="mx-auto mb-8 h-72 w-auto"
          />
        )}
        <h1 className="text-3xl font-bold text-gray-900">Welcome to CMC Social</h1>
        <p className="mt-2 text-gray-600">Connect with your fellow students</p>
      </div>
      <AuthForm />
    </div>
  );
}