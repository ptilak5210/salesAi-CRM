const fs = require('fs');
const filePath = 'frontend/pages/Dashboard/InboxView.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// The main replacements
content = content.replace(/selectedPhone/g, 'selectedJid');
content = content.replace(/setSelectedPhone/g, 'setSelectedJid');

// But we need to be careful!
// In UI, we map conversations by JID now but we also use phone for matching.
// Line 531: const selectedConversation = conversations.find(c => c.phone === selectedJid);
// We should fix this: `c.jid === selectedJid`
content = content.replace(/c => c\.phone === selectedJid/g, 'c => c.jid === selectedJid');
content = content.replace(/conv\.phone === selectedJid/g, 'conv.jid === selectedJid');
content = content.replace(/getContactLead\(selectedJid\)/g, 'null /* JID cant be used directly for getContactLead */');
// wait, getContactLead needs the lead_phone
// selectedConversation.phone has the true phone.

fs.writeFileSync(filePath, content, 'utf8');
console.log('Replaced successfully');
