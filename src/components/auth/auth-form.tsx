import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Eye, EyeOff, WifiOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const authSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
});

type AuthFormData = z.infer<typeof authSchema>;

type AuthMode = 'sign-up' | 'sign-in' | 'forgot-password' | 'reset-password' | 'enter-otp';

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const CONNECTION_CHECK_INTERVAL = 5000;
const RESET_EMAIL_COOLDOWN = 15000; // 15 seconds cooldown

export function AuthForm() {
  const [mode, setMode] = useState<AuthMode>('sign-in');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [isOffline, setIsOffline] = useState(false);
  const [resetEmailCooldown, setResetEmailCooldown] = useState(0);
  const { login } = useAuthStore();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    let intervalId: number;

    const checkConnection = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1)
          .maybeSingle();

        // Consider offline if there's an error or if we can't connect to Supabase
        setIsOffline(!!error);
        
        if (error) {
          console.warn('Connection to Supabase failed:', error.message);
        }
      } catch (error) {
        console.error('Error checking connection:', error);
        setIsOffline(true);
      }
    };

    checkConnection();
    intervalId = window.setInterval(checkConnection, CONNECTION_CHECK_INTERVAL);

    const handleOnline = () => {
      setIsOffline(false);
      checkConnection();
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cooldown timer for reset email
  useEffect(() => {
    let timeoutId: number;
    
    if (resetEmailCooldown > 0) {
      timeoutId = window.setInterval(() => {
        setResetEmailCooldown(prev => Math.max(0, prev - 1000));
      }, 1000);
    }

    return () => {
      if (timeoutId) {
        window.clearInterval(timeoutId);
      }
    };
  }, [resetEmailCooldown]);

  const retryOperation = async (operation: () => Promise<any>, retries = MAX_RETRIES): Promise<any> => {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0) {
        if (error instanceof Error && 
           (error.message.includes('failed to fetch') || 
            error.message.includes('network') || 
            error.message.includes('Unable to connect'))) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
          return retryOperation(operation, retries - 1);
        }
      }
      throw error;
    }
  };

  const handleForgotPassword = async (data: AuthFormData) => {
    if (!data.email) {
      toast.error('Please enter your email address');
      return;
    }

    if (resetEmailCooldown > 0) {
      toast.error(`Please wait ${Math.ceil(resetEmailCooldown / 1000)} seconds before requesting another reset email`);
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        data.email.trim().toLowerCase(),
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) {
        if (error.message.includes('rate_limit')) {
          setResetEmailCooldown(RESET_EMAIL_COOLDOWN);
          throw new Error('Please wait before requesting another reset email');
        }
        throw error;
      }

      setResetEmailCooldown(RESET_EMAIL_COOLDOWN);
      toast.success('Password reset instructions sent to your email');
      setMode('sign-in');
    } catch (error) {
      console.error('Error sending reset email:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Failed to send reset email');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: AuthFormData) => {
    if (isOffline) {
      toast.error('Unable to connect to the server. Please check your internet connection and try again.');
      return;
    }

    setIsLoading(true);
    try {
      switch (mode) {
        case 'sign-up': {
          const { error } = await retryOperation(() => 
            supabase.auth.signUp({
              email: data.email.trim().toLowerCase(),
              password: data.password,
              options: {
                data: {
                  first_name: data.firstName,
                  last_name: data.lastName,
                  full_name: `${data.firstName} ${data.lastName}`,
                  role: 'student'
                },
                emailRedirectTo: `${window.location.origin}/auth/callback`
              },
            })
          );

          if (error) {
            if (error.message.includes('already registered')) {
              toast.error('This email is already registered. Please sign in instead.');
            } else if (error.message.includes('failed to fetch') || error.message.includes('network')) {
              toast.error('Connection error. Please check your internet connection and try again.');
            } else {
              throw error;
            }
            return;
          }

          toast.success('Account created successfully! Please check your email to verify your account.');
          setMode('sign-in');
          break;
        }
        case 'sign-in': {
          const { data: authData, error } = await retryOperation(() =>
            supabase.auth.signInWithPassword({
              email: data.email.trim().toLowerCase(),
              password: data.password,
            })
          );

          if (error) {
            if (error.message === 'Invalid login credentials') {
              toast.error('Invalid email or password. Please try again.');
            } else if (error.message.includes('Email not confirmed')) {
              toast.error('Please verify your email address before signing in');
            } else {
              throw error;
            }
            return;
          }

          if (authData.user) {
            try {
              // Check if user is suspended
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', authData.user.id)
                .maybeSingle();

              if (profileError) throw profileError;
              if (!profile) {
                // If profile doesn't exist, create it
                const { error: createProfileError } = await supabase
                  .from('profiles')
                  .insert({
                    id: authData.user.id,
                    name: authData.user.user_metadata.full_name || 'Anonymous User',
                    role: authData.user.user_metadata.role || 'student',
                  })
                  .single();

                if (createProfileError) throw createProfileError;
              } else if (profile.role === 'suspended') {
                await supabase.auth.signOut();
                toast.error('Your account has been suspended. Please contact administration.');
                return;
              }

              const userRole = profile?.role || authData.user.user_metadata.role || 'student';

              login({
                id: authData.user.id,
                email: authData.user.email!,
                firstName: authData.user.user_metadata.first_name || '',
                lastName: authData.user.user_metadata.last_name || '',
                fullName: authData.user.user_metadata.full_name || '',
                role: userRole,
                createdAt: new Date(authData.user.created_at),
              });

              toast.success('Signed in successfully!');
            } catch (error) {
              console.error('Profile error:', error);
              throw error;
            }
          }
          break;
        }
        case 'forgot-password': {
          if (resetEmailCooldown > 0) {
            toast.error(`Please wait ${Math.ceil(resetEmailCooldown / 1000)} seconds before requesting another reset email`);
            return;
          }

          const { error } = await retryOperation(() =>
            supabase.auth.resetPasswordForEmail(data.email.trim().toLowerCase(), {
              redirectTo: `${window.location.origin}/reset-password`,
            })
          );
          
          if (error) {
            if (error.message.includes('rate_limit')) {
              setResetEmailCooldown(RESET_EMAIL_COOLDOWN);
              throw new Error('Please wait before requesting another reset email');
            }
            throw error;
          }

          setResetEmailCooldown(RESET_EMAIL_COOLDOWN);
          toast.success('Password reset instructions sent to your email');
          setMode('sign-in');
          break;
        }
      }
    } catch (error) {
      console.error('Auth error:', error);
      if (error instanceof Error) {
        if (error.message.includes('failed to fetch') || 
            error.message.includes('network') || 
            error.message.includes('Unable to connect')) {
          toast.error('Connection error. Please check your internet connection and try again.');
        } else {
          toast.error(error.message || 'Authentication failed. Please try again.');
        }
      } else {
        toast.error('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    reset();
    setMode('sign-in');
  };

  const renderPasswordRequirements = () => (
    <div className="mt-2 text-sm text-gray-600">
      <p>Password must contain:</p>
      <ul className="ml-4 list-disc">
        <li>At least 6 characters</li>
        <li>One uppercase letter (A-Z)</li>
        <li>One lowercase letter (a-z)</li>
        <li>One number (0-9)</li>
      </ul>
    </div>
  );

  if (isOffline) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4 rounded-lg bg-white p-8 shadow-lg">
        <WifiOff className="h-12 w-12 text-red-500" />
        <h2 className="text-xl font-semibold">Connection Error</h2>
        <p className="text-center text-gray-600">
          Unable to connect to the server. Please check your internet connection and try again.
        </p>
        <Button
          onClick={() => window.location.reload()}
          className="mt-4"
        >
          Retry Connection
        </Button>
      </div>
    );
  }

  const renderForm = () => {
    switch (mode) {
      case 'sign-up':
        return (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Sign Up</h1>
              <p className="text-gray-500">Create your account</p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <input
                    {...register('firstName')}
                    placeholder="First Name"
                    className="w-full rounded-lg border p-3"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-500">{errors.firstName.message}</p>
                  )}
                </div>
                <div>
                  <input
                    {...register('lastName')}
                    placeholder="Last Name"
                    className="w-full rounded-lg border p-3"
                  />
                  {errors.lastName && (
                    <p className="text-sm text-red-500">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <input
                {...register('email')}
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border p-3"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}

              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full rounded-lg border p-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
              {renderPasswordRequirements()}
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full py-6 text-lg font-semibold"
                disabled={isLoading}
              >
                Create Account
              </Button>

              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setMode('sign-in');
                  }}
                  className="text-blue-600"
                >
                  Sign In
                </button>
              </p>
            </div>
          </>
        );

      case 'sign-in':
        return (
          <>
            <div className="space-y-2 text-center">
              <h1 className="text-2xl font-bold">Sign In</h1>
              <p className="text-gray-500">Welcome back!</p>
            </div>

            <div className="space-y-4">
              <input
                {...register('email')}
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border p-3"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}

              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  className="w-full rounded-lg border p-3 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setMode('forgot-password');
                  }}
                  className="text-sm text-blue-600"
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <Button
                type="submit"
                className="w-full py-6 text-lg font-semibold"
                disabled={isLoading}
              >
                Sign In
              </Button>

              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    reset();
                    setMode('sign-up');
                  }}
                  className="text-blue-600"
                >
                  Sign Up
                </button>
              </p>
            </div>
          </>
        );

      case 'forgot-password':
        return (
          <div className="flex flex-col items-center justify-center">
            <button
              type="button"
              onClick={handleBack}
              className="mb-6 flex items-center gap-2 self-start text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
              Back
            </button>

            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold">Forgot Password</h1>
              <p className="mt-2 text-gray-500">
                Enter your email to receive password reset instructions
              </p>
            </div>

            <div className="w-full space-y-4">
              <input
                {...register('email')}
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border p-3"
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}

              <Button
                onClick={() => handleForgotPassword(watch())}
                className="w-full py-6 text-lg font-semibold"
                disabled={isLoading || resetEmailCooldown > 0}
              >
                {resetEmailCooldown > 0
                  ? `Wait ${Math.ceil(resetEmailCooldown / 1000)}s`
                  : 'Send Reset Link'}
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-sm space-y-8 rounded-lg bg-white p-8 shadow-lg">
      {renderForm()}
    </form>
  );
}