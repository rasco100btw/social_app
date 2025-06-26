import { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { CheckCircle, Circle, Clock, Flag, Plus, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/auth';

interface Todo {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_at: string;
}

export function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTodo, setNewTodo] = useState({
    title: '',
    description: '',
    due_date: '',
    priority: 'medium' as const,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthStore();
  const todoListRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetchTodos();

    // Subscribe to realtime changes
    const subscription = supabase
      .channel('todos')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'todos',
        filter: `user_id=eq.${user?.id}` 
      }, (payload) => {
        // Add new todo to the list with animation
        const newTodo = payload.new as Todo;
        setTodos(prev => {
          // Check if todo already exists to prevent duplicates
          if (prev.some(todo => todo.id === newTodo.id)) {
            return prev;
          }
          return [...prev, newTodo];
        });
        
        // Provide haptic feedback on mobile devices
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        // Update existing todo with animation
        setTodos(prev => prev.map(todo => 
          todo.id === payload.new.id ? payload.new as Todo : todo
        ));
        
        // Provide haptic feedback on mobile devices
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'todos',
        filter: `user_id=eq.${user?.id}`
      }, (payload) => {
        // Remove deleted todo with animation
        setTodos(prev => prev.filter(todo => todo.id !== payload.old.id));
        
        // Provide haptic feedback on mobile devices
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user]);

  const fetchTodos = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('due_date', { ascending: true, nullsLast: true });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
      toast.error('Failed to load todos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setIsSubmitting(true);
    
    try {
      // Generate a temporary ID for optimistic UI update
      const tempId = crypto.randomUUID();
      const tempTodo = {
        id: tempId,
        user_id: user.id,
        title: newTodo.title,
        description: newTodo.description || null,
        due_date: newTodo.due_date || null,
        priority: newTodo.priority,
        status: 'pending' as const,
        created_at: new Date().toISOString()
      };
      
      // Optimistically add the todo to the UI
      setTodos(prev => [...prev, tempTodo]);
      
      // Reset form
      setNewTodo({
        title: '',
        description: '',
        due_date: '',
        priority: 'medium'
      });
      setShowForm(false);
      
      // Show brief success indicator
      toast.success('Task added successfully');
      
      // Provide haptic feedback on mobile devices
      if (navigator.vibrate) {
        navigator.vibrate(100);
      }
      
      // Actually save to database
      const { data, error } = await supabase.from('todos').insert({
        user_id: user.id,
        title: tempTodo.title,
        description: tempTodo.description,
        due_date: tempTodo.due_date,
        priority: tempTodo.priority,
        status: 'pending'
      }).select();

      if (error) throw error;
      
      // Replace the temporary todo with the real one from the database
      if (data && data[0]) {
        setTodos(prev => prev.map(todo => 
          todo.id === tempId ? data[0] : todo
        ));
      }
    } catch (error) {
      console.error('Error creating todo:', error);
      toast.error('Failed to create task');
      
      // Remove the temporary todo on error
      setTodos(prev => prev.filter(todo => todo.id !== crypto.randomUUID()));
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateTodoStatus = async (id: string, status: Todo['status']) => {
    try {
      // Optimistically update the UI
      setTodos(prev => prev.map(todo => 
        todo.id === id ? { ...todo, status } : todo
      ));
      
      // Provide haptic feedback on mobile devices
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
      
      // Update in the database
      const { error } = await supabase
        .from('todos')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating todo:', error);
      toast.error('Failed to update task');
      
      // Revert the optimistic update on error
      fetchTodos();
    }
  };

  const deleteTodo = async (id: string, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    
    try {
      // Find the todo element
      const todoElement = document.getElementById(`todo-${id}`);
      if (todoElement) {
        // Add slide-out animation
        todoElement.style.transition = 'transform 0.4s, opacity 0.4s';
        todoElement.style.transform = 'translateX(100%)';
        todoElement.style.opacity = '0';
        
        // Provide haptic feedback on mobile devices
        if (navigator.vibrate) {
          navigator.vibrate([50, 50, 50]);
        }
        
        // Wait for animation to complete before removing from state
        setTimeout(async () => {
          // Optimistically remove from UI
          setTodos(prev => prev.filter(todo => todo.id !== id));
          
          // Delete from database
          const { error } = await supabase
            .from('todos')
            .delete()
            .eq('id', id);
    
          if (error) throw error;
          toast.success('Task deleted');
        }, 400);
      } else {
        // If element not found, just delete without animation
        setTodos(prev => prev.filter(todo => todo.id !== id));
        
        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('id', id);
  
        if (error) throw error;
        toast.success('Task deleted');
      }
    } catch (error) {
      console.error('Error deleting todo:', error);
      toast.error('Failed to delete task');
      
      // Refresh todos on error
      fetchTodos();
    }
  };

  // Handle swipe to delete
  const touchStartX = useRef<number | null>(null);
  const touchedTodoId = useRef<string | null>(null);
  
  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchedTodoId.current = id;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchedTodoId.current) return;
    
    const currentX = e.touches[0].clientX;
    const diff = touchStartX.current - currentX;
    
    // If swiped more than 100px to the left
    if (diff > 100) {
      const todoElement = document.getElementById(`todo-${touchedTodoId.current}`);
      if (todoElement) {
        todoElement.style.transition = 'transform 0.2s';
        todoElement.style.transform = `translateX(-${diff}px)`;
      }
    }
  };
  
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchedTodoId.current) return;
    
    const currentX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - currentX;
    
    // If swiped more than 150px to the left, delete the todo
    if (diff > 150) {
      deleteTodo(touchedTodoId.current);
    } else {
      // Reset position
      const todoElement = document.getElementById(`todo-${touchedTodoId.current}`);
      if (todoElement) {
        todoElement.style.transition = 'transform 0.2s';
        todoElement.style.transform = 'translateX(0)';
      }
    }
    
    touchStartX.current = null;
    touchedTodoId.current = null;
  };

  const getPriorityColor = (priority: Todo['priority']) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      case 'low':
        return 'text-green-500';
      default:
        return 'text-gray-500';
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Tasks</h1>
        <Button 
          onClick={() => setShowForm(true)}
          className="min-h-[44px] min-w-[44px]"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Task
        </Button>
      </div>

      {showForm && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <form 
            ref={formRef}
            onSubmit={handleSubmit} 
            className="space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Title</label>
              <input
                type="text"
                value={newTodo.title}
                onChange={(e) => setNewTodo({ ...newTodo, title: e.target.value })}
                className="w-full rounded-lg border p-2"
                required
                minLength={3}
                maxLength={100}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Description (Optional)</label>
              <textarea
                value={newTodo.description}
                onChange={(e) => setNewTodo({ ...newTodo, description: e.target.value })}
                className="w-full rounded-lg border p-2"
                rows={3}
                maxLength={500}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Due Date (Optional)</label>
                <input
                  type="datetime-local"
                  value={newTodo.due_date}
                  onChange={(e) => setNewTodo({ ...newTodo, due_date: e.target.value })}
                  className="w-full rounded-lg border p-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Priority</label>
                <select
                  value={newTodo.priority}
                  onChange={(e) => setNewTodo({ ...newTodo, priority: e.target.value as Todo['priority'] })}
                  className="w-full rounded-lg border p-2"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForm(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                {isSubmitting ? 'Adding...' : 'Add Task'}
              </Button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4" ref={todoListRef}>
        {todos.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-4 text-gray-600">No tasks yet</p>
          </div>
        ) : (
          todos.map((todo) => (
            <div
              id={`todo-${todo.id}`}
              key={todo.id}
              className={`rounded-lg bg-white p-4 shadow-sm transition-all duration-300 ${
                todo.status === 'completed' ? 'opacity-75' : 'opacity-100'
              }`}
              onTouchStart={(e) => handleTouchStart(e, todo.id)}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              style={{
                animation: 'fadeIn 0.3s ease-in-out',
              }}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => updateTodoStatus(todo.id, todo.status === 'completed' ? 'pending' : 'completed')}
                  className="mt-1 min-h-[24px] min-w-[24px]"
                  aria-label={todo.status === 'completed' ? 'Mark as incomplete' : 'Mark as complete'}
                >
                  {todo.status === 'completed' ? (
                    <CheckCircle className="h-6 w-6 text-green-500 transition-all duration-200" />
                  ) : (
                    <Circle className="h-6 w-6 text-gray-400 transition-all duration-200" />
                  )}
                </button>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-medium transition-all duration-200 ${todo.status === 'completed' ? 'line-through text-gray-500' : ''}`}>
                      {todo.title}
                    </h3>
                    <Flag className={`h-4 w-4 ${getPriorityColor(todo.priority)}`} />
                  </div>

                  {todo.description && (
                    <p className={`mt-1 text-sm ${todo.status === 'completed' ? 'text-gray-400' : 'text-gray-600'}`}>
                      {todo.description}
                    </p>
                  )}

                  <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                    {todo.due_date && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{format(new Date(todo.due_date), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={(e) => deleteTodo(todo.id, e)}
                  className="min-h-[44px] min-w-[44px] text-red-500 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete task"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}