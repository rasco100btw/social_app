import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, RefreshCw, Copy, Check, ArrowDown, ChevronRight, ChevronDown, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuthStore } from '../store/auth';
import { toast } from 'sonner';
import { sendMessageToAI, saveChatHistory, loadChatHistory } from '../lib/helpchat';
import { Message } from '../types';

// FAQ categories and questions
const FAQ_CATEGORIES = [
  {
    name: 'Academic',
    questions: [
      { 
        question: 'How do I register for classes?', 
        answer: 'To register for classes, log in to the student portal and navigate to "Course Registration." Select the semester, browse available courses, and add them to your schedule. Make sure to check for prerequisites and time conflicts before finalizing your registration.' 
      },
      { 
        question: 'What is the deadline for dropping a class?', 
        answer: 'The deadline for dropping a class without academic penalty is typically the end of the 10th week of the semester. However, this may vary by semester, so always check the academic calendar for the exact dates. After this deadline, withdrawals will result in a "W" on your transcript.' 
      },
      { 
        question: 'How do I request an official transcript?', 
        answer: 'Official transcripts can be requested through the Registrar\'s Office. Log in to your student portal, navigate to "Academic Records," and select "Request Official Transcript." There is usually a small fee for each transcript requested. Processing typically takes 3-5 business days.' 
      },
      { 
        question: 'What is the minimum GPA requirement to maintain good academic standing?', 
        answer: 'To maintain good academic standing, undergraduate students must maintain a cumulative GPA of at least 2.0. Graduate students typically need to maintain a 3.0 GPA. Falling below these thresholds may result in academic probation.' 
      }
    ]
  },
  {
    name: 'Financial',
    questions: [
      { 
        question: 'How do I apply for financial aid?', 
        answer: 'To apply for financial aid, you need to complete the Free Application for Federal Student Aid (FAFSA) at fafsa.gov. Our school code is 003456. After submission, the financial aid office will determine your eligibility and notify you of available aid packages.' 
      },
      { 
        question: 'When is tuition payment due?', 
        answer: 'Tuition payment is due two weeks before the start of each semester. For the fall semester, this is typically mid-August, and for spring, it\'s early January. You can pay online through the student portal or at the Bursar\'s Office. Payment plans are also available if you need to spread payments throughout the semester.' 
      },
      { 
        question: 'Are there any scholarships available?', 
        answer: 'Yes, the university offers various scholarships based on academic merit, financial need, and specific talents or interests. Visit the Financial Aid Office website for a complete list of available scholarships and their application deadlines. Most scholarship applications for the upcoming academic year are due by March 1st.' 
      },
      { 
        question: 'How do I set up a payment plan?', 
        answer: 'Payment plans can be set up through the Bursar\'s Office. Log in to your student portal, go to "Financial Services," and select "Payment Plan." You can choose to divide your semester charges into 3-5 monthly payments. There is a small enrollment fee for using the payment plan service.' 
      }
    ]
  },
  {
    name: 'Campus Life',
    questions: [
      { 
        question: 'How do I join a student club or organization?', 
        answer: 'You can join student clubs and organizations by attending the Student Activities Fair held during the first two weeks of each semester. Alternatively, browse the complete list of organizations on the Student Life website and contact the club leaders directly. Most clubs welcome new members throughout the year.' 
      },
      { 
        question: 'What dining options are available on campus?', 
        answer: 'Our campus features several dining options including the Main Dining Hall (open 7am-9pm), the Student Union Food Court (with various fast food options), the Library Café, and several coffee shops across campus. Meal plans can be used at all these locations, and most accept credit/debit cards as well.' 
      },
      { 
        question: 'How do I reserve a study room in the library?', 
        answer: 'Study rooms in the library can be reserved online through the Library website. Log in with your student credentials, select "Room Reservations," choose an available time slot, and specify the number of people. Rooms can be reserved up to two weeks in advance for 2-hour blocks.' 
      },
      { 
        question: 'What mental health resources are available to students?', 
        answer: 'The university offers free counseling services to all enrolled students through the Student Wellness Center. Services include individual counseling, group therapy, crisis intervention, and workshops on stress management and mindfulness. You can schedule an appointment by calling 555-123-4567 or visiting the Wellness Center in person.' 
      }
    ]
  },
  {
    name: 'Technology',
    questions: [
      { 
        question: 'How do I reset my student account password?', 
        answer: 'To reset your student account password, go to the IT Services website and click on "Password Reset." You\'ll need to provide your student ID and answer security questions. Alternatively, you can visit the IT Help Desk in the Library with your student ID for in-person assistance.' 
      },
      { 
        question: 'How do I connect to the campus Wi-Fi?', 
        answer: 'To connect to campus Wi-Fi, select the "Campus-Secure" network from your device\'s Wi-Fi settings. When prompted, enter your student email and password. Your device should remember these credentials for future connections. For technical issues, contact the IT Help Desk.' 
      },
      { 
        question: 'What software is available to students for free?', 
        answer: 'Students have free access to Microsoft Office 365 (including Word, Excel, PowerPoint), Adobe Creative Cloud, SPSS, MATLAB, and various programming tools. To download, visit the IT Services website, log in with your student credentials, and navigate to "Software Downloads."' 
      },
      { 
        question: 'How do I access my student email?', 
        answer: 'Your student email can be accessed at mail.university.edu or through the Office 365 portal. You can also set up your email on mobile devices using the Outlook app. Your email address is your studentID@university.edu and uses the same password as your student account.' 
      }
    ]
  },
  {
    name: 'Administration',
    questions: [
      { 
        question: 'How do I declare or change my major?', 
        answer: 'To declare or change your major, you need to complete a Major Declaration/Change Form, available at the Registrar\'s Office or online through the student portal. The form requires your signature and the signature of the department chair of your new major. Submit the completed form to the Registrar\'s Office.' 
      },
      { 
        question: 'What is the process for taking a leave of absence?', 
        answer: 'To request a leave of absence, submit a Leave of Absence Form to the Registrar\'s Office at least 30 days before the start of the semester when the leave will begin. Include documentation supporting your request if applicable. Leaves are typically granted for medical reasons, military service, or significant personal circumstances.' 
      },
      { 
        question: 'How do I get an enrollment verification letter?', 
        answer: 'Enrollment verification letters can be requested through the Registrar\'s Office. Log in to your student portal, go to "Academic Records," and select "Request Enrollment Verification." The letter will confirm your enrollment status, which is often needed for insurance, housing, or employment purposes.' 
      },
      { 
        question: 'What is the process for appealing a grade?', 
        answer: 'Grade appeals must be initiated within 30 days of the grade posting. First, discuss the grade with your instructor. If unresolved, submit a written appeal to the department chair with supporting documentation. If still unresolved, you may appeal to the academic dean. The entire process is outlined in the Student Handbook.' 
      }
    ]
  },
  {
    name: 'Graduation',
    questions: [
      { 
        question: 'How do I apply for graduation?', 
        answer: 'To apply for graduation, log in to your student portal and select "Apply for Graduation" under Academic Records. Complete the application and pay the graduation fee. Applications must be submitted by October 1 for fall graduation, February 1 for spring graduation, and June 1 for summer graduation.' 
      },
      { 
        question: 'When is the commencement ceremony?', 
        answer: 'Commencement ceremonies are typically held in mid-May for spring graduates, mid-December for fall graduates, and early August for summer graduates. Specific dates, times, and locations are announced approximately three months before each ceremony and will be communicated via your student email.' 
      },
      { 
        question: 'How do I order my cap and gown?', 
        answer: 'Cap and gown orders can be placed through the University Bookstore, either in person or online. Orders typically open three months before graduation and close one month before the ceremony. The bookstore will send email reminders with ordering deadlines and pickup information.' 
      },
      { 
        question: 'What are the requirements to graduate with honors?', 
        answer: 'To graduate with honors, you must achieve the following cumulative GPA: Cum Laude (3.5-3.69), Magna Cum Laude (3.7-3.89), or Summa Cum Laude (3.9-4.0). Honors are calculated based on your GPA at the end of the semester prior to graduation and are noted on your diploma and transcript.' 
      }
    ]
  }
];

export function HelpChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState<string | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [showFAQ, setShowFAQ] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();

  // Load messages from localStorage
  useEffect(() => {
    const savedMessages = loadChatHistory();
    if (savedMessages.length > 0) {
      setMessages(savedMessages);
    } else {
      // Add welcome message if no history exists
      const welcomeMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm your CMC Social assistant. I can help with academic questions, study techniques, and educational resources. How can I assist you today?",
        timestamp: new Date(),
      };
      setMessages([welcomeMessage]);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Show/hide scroll button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowFAQ(false);

    try {
      // Get all messages for context (limit to last 10 for performance)
      const recentMessages = [...messages.slice(-10), userMessage];
      
      // Send to AI and get response
      const aiResponse = await sendMessageToAI(recentMessages);
      
      // Add AI response
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setRetryCount(0); // Reset retry count on success
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Handle different error scenarios
      let errorMessage = "I'm sorry, I'm having trouble connecting to my knowledge base right now. Please try again in a moment.";
      
      if (error instanceof Error) {
        if (error.message.includes('Network error')) {
          errorMessage = "I'm having trouble connecting to the server. Please check your internet connection and try again.";
        } else if (error.message.includes('OpenAI API')) {
          errorMessage = "I'm experiencing some technical difficulties with my AI service. Please try again in a few minutes.";
        }
      }

      // Add error message to chat
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date(),
      };
      
      setMessages((prev) => [...prev, errorResponse]);
      
      // Show toast with retry option if under retry limit
      if (retryCount < 3) {
        toast.error('Failed to get a response', {
          action: {
            label: 'Retry',
            onClick: () => {
              setRetryCount(prev => prev + 1);
              handleSendMessage();
            },
          },
        });
      } else {
        toast.error('Multiple attempts failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      const initialMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Hello! I'm your CMC Social assistant. I can help with academic questions, study techniques, and educational resources. How can I assist you today?",
        timestamp: new Date(),
      };
      
      setMessages([initialMessage]);
      localStorage.removeItem('helpchat-messages');
      setShowFAQ(true);
    }
  };

  const copyMessage = (messageId: string, content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        setIsCopied(messageId);
        setTimeout(() => setIsCopied(null), 2000);
        toast.success('Message copied to clipboard');
      })
      .catch(() => {
        toast.error('Failed to copy message');
      });
  };

  // Function to render message content with markdown-like formatting
  const renderMessageContent = (content: string) => {
    // Replace **text** with bold
    let formattedContent = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Replace *text* with italic
    formattedContent = formattedContent.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Replace numbered lists
    formattedContent = formattedContent.replace(/^\d+\.\s(.*)$/gm, '<li>$1</li>');
    
    // Replace bullet points
    formattedContent = formattedContent.replace(/^-\s(.*)$/gm, '<li>$1</li>');
    
    // Replace newlines with <br>
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return <div dangerouslySetInnerHTML={{ __html: formattedContent }} />;
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category) 
        : [...prev, category]
    );
  };

  const handleFAQClick = (question: string, answer: string) => {
    // Add the question as a user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    // Add the answer as an assistant message
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: answer,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setShowFAQ(false);
    
    // Scroll to the bottom after a short delay to ensure the new messages are rendered
    setTimeout(() => {
      scrollToBottom();
    }, 100);
  };

  // Filter FAQ based on search query
  const filteredFAQ = searchQuery.trim() === '' 
    ? FAQ_CATEGORIES 
    : FAQ_CATEGORIES.map(category => ({
        ...category,
        questions: category.questions.filter(q => 
          q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.answer.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(category => category.questions.length > 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Bot className="h-6 w-6 text-blue-600" />
          <h1 className="text-xl font-semibold">Help Chat</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFAQ(!showFAQ)}
            className="min-h-[44px]"
          >
            {showFAQ ? 'Hide FAQ' : 'Show FAQ'}
          </Button>
          <Button 
            variant="ghost" 
            onClick={clearChat}
            className="text-gray-500 hover:text-gray-700 min-h-[44px] min-w-[44px]"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {showFAQ ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search FAQ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border bg-white pl-10 pr-4 py-2 min-h-[44px]"
              />
            </div>
          </div>
          
          {filteredFAQ.length === 0 ? (
            <div className="rounded-lg bg-white p-6 text-center shadow">
              <p className="text-gray-500">No matching questions found. Try a different search term.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFAQ.map((category) => (
                <div key={category.name} className="rounded-lg bg-white shadow">
                  <button
                    onClick={() => toggleCategory(category.name)}
                    className="flex w-full items-center justify-between p-4 text-left font-medium min-h-[44px]"
                  >
                    <span>{category.name}</span>
                    {expandedCategories.includes(category.name) ? (
                      <ChevronDown className="h-5 w-5" />
                    ) : (
                      <ChevronRight className="h-5 w-5" />
                    )}
                  </button>
                  
                  {expandedCategories.includes(category.name) && (
                    <div className="border-t px-4 py-2">
                      {category.questions.map((item, index) => (
                        <button
                          key={index}
                          onClick={() => handleFAQClick(item.question, item.answer)}
                          className="mb-2 w-full rounded-lg p-3 text-left hover:bg-gray-50 min-h-[44px]"
                        >
                          <p className="font-medium text-blue-600">{item.question}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div 
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto bg-gray-50 p-4"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`mb-4 flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`relative max-w-[85%] rounded-lg px-4 py-3 md:max-w-[75%] ${
                  message.role === 'user'
                    ? 'rounded-br-none bg-blue-600 text-white'
                    : 'rounded-bl-none bg-white'
                }`}
              >
                <div className="mb-1 flex items-center gap-2">
                  {message.role === 'assistant' ? (
                    <Bot className="h-4 w-4 text-blue-600" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">
                    {message.role === 'assistant' ? 'Assistant' : user?.fullName || 'You'}
                  </span>
                  <span className="text-xs opacity-75">
                    {typeof message.timestamp.toLocaleTimeString === 'function' 
                      ? message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap break-words">
                  {renderMessageContent(message.content)}
                </div>
                
                {/* Copy button */}
                <button
                  onClick={() => copyMessage(message.id, message.content)}
                  className={`absolute right-2 top-2 rounded-full p-1 min-h-[24px] min-w-[24px] ${
                    message.role === 'user' 
                      ? 'bg-blue-700 text-white hover:bg-blue-800' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {isCopied === message.id ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="mb-4 flex justify-start">
              <div className="flex max-w-[85%] items-center gap-2 rounded-lg rounded-bl-none bg-white px-4 py-3 md:max-w-[75%]">
                <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                <span className="text-gray-500">Assistant is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Scroll to bottom button */}
      {showScrollButton && !showFAQ && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-20 right-4 rounded-full bg-blue-600 p-2 text-white shadow-lg hover:bg-blue-700 md:bottom-24 min-h-[44px] min-w-[44px]"
        >
          <ArrowDown className="h-5 w-5" />
        </button>
      )}

      <div className="border-t bg-white p-4">
        <div className="flex items-center gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me about academic topics, study techniques, or educational resources..."
            className="flex-1 resize-none rounded-lg border border-gray-300 p-3 focus:border-blue-500 focus:outline-none min-h-[44px]"
            rows={2}
            disabled={isLoading}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="h-12 w-12 rounded-full p-0 min-h-[44px] min-w-[44px]"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-gray-500">
          Ask questions about academic subjects, study techniques, or educational resources.
        </p>
      </div>
    </div>
  );
}