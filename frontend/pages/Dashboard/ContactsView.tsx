import React, { useState, useEffect } from 'react';
import { 
    Users, Search, Plus, MoreVertical, Edit2, Trash2, 
    MessageSquare, Loader2, Phone, User, X, Check,
    AlertCircle
} from 'lucide-react';
import { getContacts, createContact, updateContact, deleteContact, Contact } from '../../services/contactsService';

export const ContactsView = () => {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
    
    // Form state
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        fetchContacts();
    }, []);

    const fetchContacts = async (search?: string) => {
        setLoading(true);
        const data = await getContacts(search);
        setContacts(data);
        setLoading(false);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchContacts(searchTerm);
    };

    const handleAddContact = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormLoading(true);
        setFormError('');
        const res = await createContact(name, phone);
        if (res.success) {
            setIsAddModalOpen(false);
            resetForm();
            fetchContacts();
        } else {
            setFormError(res.error || 'Failed to create contact');
        }
        setFormLoading(false);
    };

    const handleUpdateContact = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedContact) return;
        setFormLoading(true);
        setFormError('');
        const res = await updateContact(selectedContact.id, name, phone);
        if (res.success) {
            setIsEditModalOpen(false);
            resetForm();
            fetchContacts();
        } else {
            setFormError(res.error || 'Failed to update contact');
        }
        setFormLoading(false);
    };

    const handleDeleteContact = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this contact?')) return;
        const res = await deleteContact(id);
        if (res.success) {
            fetchContacts();
        } else {
            alert('Error deleting contact: ' + res.error);
        }
    };

    const resetForm = () => {
        setName('');
        setPhone('');
        setFormError('');
        setSelectedContact(null);
    };

    const openEditModal = (contact: Contact) => {
        setSelectedContact(contact);
        setName(contact.name);
        setPhone(contact.phone);
        setIsEditModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Contacts</h1>
                    <p className="text-slate-500">Manage your WhatsApp contacts and leads</p>
                </div>
                <button 
                    onClick={() => { resetForm(); setIsAddModalOpen(true); }}
                    className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Add Contact
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input 
                        type="text" 
                        placeholder="Search by name or phone..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                </form>
            </div>

            {/* Contacts Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        <p className="text-slate-500 font-medium">Loading contacts...</p>
                    </div>
                ) : contacts.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                            <Users size={32} />
                        </div>
                        <div>
                            <p className="text-slate-800 font-bold text-lg">No contacts found</p>
                            <p className="text-slate-500">Start by adding your first WhatsApp contact</p>
                        </div>
                        <button 
                            onClick={() => setIsAddModalOpen(true)}
                            className="text-indigo-600 font-semibold hover:underline"
                        >
                            Add New Contact
                        </button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Contact</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Phone</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Added</th>
                                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {contacts.map((contact) => (
                                    <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                                    {contact.name ? contact.name[0]?.toUpperCase() : '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-slate-800">{contact.name || 'Unnamed'}</p>
                                                    <p className="text-xs text-slate-400 font-medium">{contact.jid}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                                                <Phone className="w-3.5 h-3.5 text-slate-400" />
                                                +{contact.phone}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs text-slate-500 font-medium">
                                                {new Date(contact.createdAt).toLocaleDateString()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button 
                                                    onClick={() => openEditModal(contact)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                                    title="Edit"
                                                    aria-label="Edit Contact"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteContact(contact.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete"
                                                    aria-label="Delete Contact"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Add/Edit Modal */}
            {(isAddModalOpen || isEditModalOpen) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-50">
                            <h2 className="text-xl font-bold text-slate-800">
                                {isEditModalOpen ? 'Edit Contact' : 'Add New Contact'}
                            </h2>
                            <button 
                                onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }}
                                className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                                title="Close"
                                aria-label="Close Modal"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={isEditModalOpen ? handleUpdateContact : handleAddContact} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-sm">
                                    <AlertCircle className="w-4 h-4" />
                                    {formError}
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                                    Full Name
                                </label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5 ml-1">
                                    Phone Number
                                </label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                    <input 
                                        type="tel" 
                                        required
                                        placeholder="919876543210"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                                    />
                                </div>
                                <p className="mt-1.5 text-[10px] text-slate-400 ml-1">Include country code without + or spaces (e.g. 919876543210)</p>
                            </div>

                            <button 
                                type="submit"
                                disabled={formLoading}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-70 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200 mt-2 flex items-center justify-center gap-2"
                            >
                                {formLoading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : isEditModalOpen ? (
                                    'Save Changes'
                                ) : (
                                    'Add Contact'
                                )}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
