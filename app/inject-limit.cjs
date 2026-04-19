const fs = require('fs');

const file = './src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const find = `setInput('');
    setStarted(true);
    setShowHistory(false);
    setPendingQuestion(null);`;

const replace = `setInput('');
    setStarted(true);
    setShowHistory(false);
    setPendingQuestion(null);

    // DAILY USAGE LIMIT
    const { checkAndIncrementUsage } = await import('./utils/usageLimit.js');
    const { allowed } = await checkAndIncrementUsage();
    if (!allowed) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "You've used your 15 messages for today. Rest, apply what you worked on, and I'll be back tomorrow."
      }]);
      setLoading(false);
      return;
    }`;

if (content.includes(find)) {
  content = content.replace(find, replace);
  fs.writeFileSync(file, content, 'utf8');
  console.log('SUCCESS - limit injected');
} else {
  console.log('NOT FOUND - no changes made');
}