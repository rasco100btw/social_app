import { useState, useEffect } from 'react';
import { Search, Star, StarOff, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

interface Hobby {
  id: string;
  name: string;
  description: string;
  category_id: string;
  time_commitment: string;
  cost_level: string;
  category: {
    name: string;
  };
}

interface UserHobby {
  hobby_id: string;
  is_favorite: boolean;
  priority_level: number;
}

export function HobbyBrowser() {
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [hobbies, setHobbies] = useState<Hobby[]>([]);
  const [userHobbies, setUserHobbies] = useState<UserHobby[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories
        const { data: categoriesData, error: categoriesError } = await supabase
          .from('hobby_categories')
          .select('id, name')
          .order('name');

        if (categoriesError) throw categoriesError;
        setCategories(categoriesData);

        // Fetch hobbies with categories
        const { data: hobbiesData, error: hobbiesError } = await supabase
          .from('hobbies')
          .select(`
            *,
            category:hobby_categories(name)
          `)
          .order('name');

        if (hobbiesError) throw hobbiesError;
        setHobbies(hobbiesData);

        // Fetch user's hobbies
        if (user) {
          const { data: userHobbiesData, error: userHobbiesError } = await supabase
            .from('user_hobbies')
            .select('hobby_id, is_favorite, priority_level')
            .eq('user_id', user.id);

          if (userHobbiesError) throw userHobbiesError;
          setUserHobbies(userHobbiesData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load hobbies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const filteredHobbies = hobbies.filter(hobby => {
    const matchesCategory = !selectedCategory || hobby.category_id === selectedCategory;
    const matchesSearch = !searchQuery || 
      hobby.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      hobby.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const toggleHobby = async (hobbyId: string) => {
    if (!user) return;

    const existingHobby = userHobbies.find(h => h.hobby_id === hobbyId);

    try {
      if (existingHobby) {
        // Remove hobby
        const { error } = await supabase
          .from('user_hobbies')
          .delete()
          .eq('user_id', user.id)
          .eq('hobby_id', hobbyId);

        if (error) throw error;

        setUserHobbies(prev => prev.filter(h => h.hobby_id !== hobbyId));
        toast.success('Hobby removed');
      } else {
        // Add hobby
        const { error } = await supabase
          .from('user_hobbies')
          .insert({
            user_id: user.id,
            hobby_id: hobbyId,
            priority_level: 1
          });

        if (error) throw error;

        setUserHobbies(prev => [...prev, { hobby_id: hobbyId, is_favorite: false, priority_level: 1 }]);
        toast.success('Hobby added');
      }
    } catch (error) {
      console.error('Error toggling hobby:', error);
      toast.error('Failed to update hobby');
    }
  };

  const toggleFavorite = async (hobbyId: string) => {
    if (!user) return;

    const hobby = userHobbies.find(h => h.hobby_id === hobbyId);
    if (!hobby) return;

    try {
      const { error } = await supabase
        .from('user_hobbies')
        .update({ is_favorite: !hobby.is_favorite })
        .eq('user_id', user.id)
        .eq('hobby_id', hobbyId);

      if (error) throw error;

      setUserHobbies(prev =>
        prev.map(h =>
          h.hobby_id === hobbyId ? { ...h, is_favorite: !h.is_favorite } : h
        )
      );

      toast.success(hobby.is_favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      console.error('Error toggling favorite:', error);
      toast.error('Failed to update favorite status');
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search hobbies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'primary' : 'ghost'}
            onClick={() => setSelectedCategory(null)}
          >
            All
          </Button>
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? 'primary' : 'ghost'}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Hobbies Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredHobbies.map((hobby) => {
          const userHobby = userHobbies.find(h => h.hobby_id === hobby.id);
          return (
            <div
              key={hobby.id}
              className="rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{hobby.name}</h3>
                  <p className="text-sm text-gray-500">{hobby.category.name}</p>
                </div>
                <div className="flex gap-2">
                  {userHobby && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFavorite(hobby.id)}
                    >
                      {userHobby.is_favorite ? (
                        <Star className="h-5 w-5 text-yellow-400" />
                      ) : (
                        <StarOff className="h-5 w-5 text-gray-400" />
                      )}
                    </Button>
                  )}
                  <Button
                    variant={userHobby ? 'outline' : 'primary'}
                    size="sm"
                    onClick={() => toggleHobby(hobby.id)}
                  >
                    {userHobby ? (
                      <Minus className="h-5 w-5" />
                    ) : (
                      <Plus className="h-5 w-5" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="mb-3 text-sm">{hobby.description}</p>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Time: {hobby.time_commitment}</span>
                <span>Cost: {hobby.cost_level}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}