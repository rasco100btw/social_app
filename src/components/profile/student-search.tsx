import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';

interface Student {
  id: string;
  name: string;
  avatar_url: string;
  academic_program: string;
  year_of_study: number;
}

export function StudentSearch() {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    program: '',
    year: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        let query = supabase
          .from('profiles')
          .select('id, name, avatar_url, academic_program, year_of_study')
          .order('name');

        if (searchQuery) {
          query = query.ilike('name', `%${searchQuery}%`);
        }

        if (filters.program) {
          query = query.eq('academic_program', filters.program);
        }

        if (filters.year) {
          query = query.eq('year_of_study', filters.year);
        }

        const { data, error } = await query;

        if (error) throw error;
        setStudents(data || []);
      } catch (error) {
        console.error('Error fetching students:', error);
        toast.error('Failed to load students');
      } finally {
        setIsLoading(false);
      }
    };

    fetchStudents();
  }, [searchQuery, filters]);

  return (
    <div className="space-y-6">
      {/* Search and Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search students..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border pl-10 pr-4 py-2"
            />
          </div>
        </div>
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setFilters({ program: '', year: '' })}
        >
          <Filter className="h-5 w-5" />
          Clear Filters
        </Button>
      </div>

      {/* Students Grid */}
      {isLoading ? (
        <div className="flex justify-center p-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {students.map((student) => (
            <button
              key={student.id}
              onClick={() => navigate(`/profile/${student.id}`)}
              className="flex items-center gap-4 rounded-lg border bg-white p-4 text-left transition-shadow hover:shadow-md"
            >
              <img
                src={student.avatar_url || 'https://via.placeholder.com/64'}
                alt={student.name}
                className="h-16 w-16 rounded-full object-cover"
              />
              <div>
                <h3 className="font-medium">{student.name}</h3>
                <p className="text-sm text-gray-600">{student.academic_program}</p>
                <p className="text-sm text-gray-500">Year {student.year_of_study}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}