import { useState, useEffect } from 'react';
import { Search, Plus, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/auth';

const HOBBY_CATEGORIES = [
  {
    name: 'Sports & Fitness',
    hobbies: ['Basketball', 'Football', 'Swimming', 'Yoga', 'Running', 'Tennis', 'Cycling', 'Dance']
  },
  {
    name: 'Arts & Creativity',
    hobbies: ['Painting', 'Drawing', 'Photography', 'Writing', 'Music', 'Crafts', 'Sculpture', 'Design']
  },
  {
    name: 'Technology',
    hobbies: ['Programming', 'Gaming', '3D Printing', 'Web Development', 'AI/ML', 'Robotics', 'Electronics']
  },
  {
    name: 'Learning',
    hobbies: ['Reading', 'Language Learning', 'History', 'Science', 'Philosophy', 'Psychology', 'Mathematics']
  },
  {
    name: 'Entertainment',
    hobbies: ['Movies', 'TV Shows', 'Board Games', 'Video Games', 'Podcasts', 'Anime/Manga', 'Music']
  },
  {
    name: 'Outdoors',
    hobbies: ['Hiking', 'Camping', 'Gardening', 'Bird Watching', 'Rock Climbing', 'Fishing', 'Photography']
  },
  {
    name: 'Food & Cooking',
    hobbies: ['Cooking', 'Baking', 'Wine Tasting', 'Coffee Brewing', 'Food Photography', 'Recipe Development']
  },
  {
    name: 'Social',
    hobbies: ['Volunteering', 'Public Speaking', 'Event Planning', 'Networking', 'Teaching', 'Mentoring']
  }
];

const MAX_HOBBIES = 5;

export function HobbySelector() {
  const [selectedHobbies, setSelectedHobbies] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customHobby, setCustomHobby] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    if (!user) return;

    const fetchUserHobbies = async () => {
      try {
        setIsLoading(true);
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('hobbies')
          .eq('id', user.id)
          .single();

        if (error) throw error;
        
        // Ensure hobbies is an array
        let hobbies: string[] = [];
        if (profile?.hobbies) {
          if (Array.isArray(profile.hobbies)) {
            hobbies = profile.hobbies;
          } else if (typeof profile.hobbies === 'string') {
            // Handle case where hobbies might be a string
            try {
              const parsed = JSON.parse(profile.hobbies);
              if (Array.isArray(parsed)) {
                hobbies = parsed;
              }
            } catch (e) {
              // If parsing fails, treat as empty array
              console.error('Error parsing hobbies:', e);
            }
          }
        }
        
        setSelectedHobbies(hobbies);
      } catch (error) {
        console.error('Error fetching hobbies:', error);
        toast.error('Failed to load hobbies');
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserHobbies();
  }, [user]);

  const saveHobbies = async (hobbies: string[]) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('profiles')
        .update({ 
          hobbies,
          name: user.fullName // Ensure name is set to prevent not-null constraint violation
        })
        .eq('id', user.id);

      if (error) throw error;
      toast.success('Hobbies updated successfully');
    } catch (error) {
      console.error('Error saving hobbies:', error);
      toast.error('Failed to save hobbies');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleHobby = (hobby: string) => {
    const newHobbies = selectedHobbies.includes(hobby)
      ? selectedHobbies.filter(h => h !== hobby)
      : selectedHobbies.length < MAX_HOBBIES
        ? [...selectedHobbies, hobby]
        : selectedHobbies;

    if (!selectedHobbies.includes(hobby) && selectedHobbies.length >= MAX_HOBBIES) {
      toast.error(`You can only select up to ${MAX_HOBBIES} hobbies`);
      return;
    }

    setSelectedHobbies(newHobbies);
    saveHobbies(newHobbies);
  };

  const addCustomHobby = () => {
    if (!customHobby.trim()) return;
    if (selectedHobbies.length >= MAX_HOBBIES) {
      toast.error(`You can only select up to ${MAX_HOBBIES} hobbies`);
      return;
    }
    if (selectedHobbies.includes(customHobby.trim())) {
      toast.error('This hobby is already selected');
      return;
    }

    const newHobbies = [...selectedHobbies, customHobby.trim()];
    setSelectedHobbies(newHobbies);
    saveHobbies(newHobbies);
    setCustomHobby('');
  };

  const filteredCategories = HOBBY_CATEGORIES
    .map(category => ({
      ...category,
      hobbies: category.hobbies.filter(hobby =>
        hobby.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }))
    .filter(category => 
      !selectedCategory || category.name === selectedCategory
    )
    .filter(category => category.hobbies.length > 0);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Hobbies */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-medium">Your Hobbies</h3>
          <span className="text-sm text-gray-500">
            {selectedHobbies.length}/{MAX_HOBBIES} selected
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedHobbies.map((hobby) => (
            <div
              key={hobby}
              className="flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
            >
              {hobby}
              <button
                onClick={() => toggleHobby(hobby)}
                className="rounded-full p-1 hover:bg-blue-200"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search and Category Filter */}
      <div className="space-y-4">
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

        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? 'default' : 'outline'}
            onClick={() => setSelectedCategory(null)}
          >
            All Categories
          </Button>
          {HOBBY_CATEGORIES.map((category) => (
            <Button
              key={category.name}
              variant={selectedCategory === category.name ? 'default' : 'outline'}
              onClick={() => setSelectedCategory(category.name)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Hobby Categories */}
      <div className="space-y-6">
        {filteredCategories.map((category) => (
          <div key={category.name}>
            <h3 className="mb-3 font-medium">{category.name}</h3>
            <div className="flex flex-wrap gap-2">
              {category.hobbies.map((hobby) => (
                <button
                  key={hobby}
                  onClick={() => toggleHobby(hobby)}
                  className={`rounded-full px-4 py-2 text-sm transition-colors ${
                    selectedHobbies.includes(hobby)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {hobby}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Custom Hobby */}
      <div>
        <h3 className="mb-2 font-medium">Add Custom Hobby</h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={customHobby}
            onChange={(e) => setCustomHobby(e.target.value)}
            placeholder="Enter a custom hobby"
            className="flex-1 rounded-lg border p-2"
            maxLength={30}
          />
          <Button
            onClick={addCustomHobby}
            disabled={!customHobby.trim() || selectedHobbies.length >= MAX_HOBBIES}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}