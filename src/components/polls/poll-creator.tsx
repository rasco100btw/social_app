import { useState } from 'react';
import { Plus, X, Calendar } from 'lucide-react';
import { Button } from '../ui/button';

interface PollCreatorProps {
  question: string;
  setQuestion: (question: string) => void;
  options: string[];
  setOptions: (options: string[]) => void;
  endDate: string;
  setEndDate: (date: string) => void;
}

export function PollCreator({ 
  question, 
  setQuestion, 
  options, 
  setOptions,
  endDate,
  setEndDate
}: PollCreatorProps) {
  const [newOption, setNewOption] = useState('');

  const addOption = () => {
    if (!newOption.trim()) return;
    
    // Check for duplicates
    if (options.includes(newOption.trim())) {
      return;
    }
    
    setOptions([...options, newOption.trim()]);
    setNewOption('');
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addOption();
    }
  };

  // Calculate minimum date for the datepicker (today)
  const today = new Date();
  const minDate = today.toISOString().split('T')[0];

  // Calculate maximum date (30 days from now)
  const maxDate = new Date(today);
  maxDate.setDate(today.getDate() + 30);
  const maxDateString = maxDate.toISOString().split('T')[0];

  return (
    <div className="rounded-lg border bg-blue-50 p-4">
      <h3 className="mb-4 font-medium text-blue-800">Create a Poll</h3>
      
      <div className="space-y-4">
        {/* Poll Question */}
        <div>
          <label className="mb-1 block text-sm font-medium text-blue-800">
            Question
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question..."
            className="w-full rounded-md border border-blue-200 bg-white p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            maxLength={100}
          />
          <div className="mt-1 flex justify-end">
            <span className="text-xs text-blue-600">
              {question.length}/100
            </span>
          </div>
        </div>

        {/* Poll Options */}
        <div>
          <label className="mb-1 block text-sm font-medium text-blue-800">
            Options (2-10)
          </label>
          <div className="space-y-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1 rounded-md border border-blue-200 bg-white p-2">
                  {option}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOption(index)}
                  className="h-8 w-8 rounded-full p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            {options.length < 10 && (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newOption}
                  onChange={(e) => setNewOption(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Add option..."
                  className="flex-1 rounded-md border border-blue-200 bg-white p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  maxLength={50}
                />
                <Button
                  type="button"
                  onClick={addOption}
                  disabled={!newOption.trim()}
                  className="h-9 w-9 rounded-full p-0"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-blue-600">
            {options.length}/10 options added
          </p>
        </div>

        {/* Poll End Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-blue-800">
            End Date (Optional)
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-blue-500" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={minDate}
              max={maxDateString}
              className="w-full rounded-md border border-blue-200 bg-white p-2 pl-10 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <p className="mt-1 text-xs text-blue-600">
            Poll will remain open indefinitely if no end date is set
          </p>
        </div>
      </div>
    </div>
  );
}