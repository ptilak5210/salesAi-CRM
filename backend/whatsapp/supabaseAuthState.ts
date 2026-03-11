import { supabaseAdmin } from '../../database/supabase';
import { AuthenticationCreds, SignalDataTypeMap, initAuthCreds, BufferJSON } from '@whiskeysockets/baileys';

export const useSupabaseAuthState = async (userId: string) => {
    if (!supabaseAdmin) throw new Error('Supabase admin client not initialized');

    const writeData = async (data: any, id: string) => {
        try {
            const dataString = JSON.stringify(data, BufferJSON.replacer);
            await supabaseAdmin
                .from('whatsapp_sessions')
                .upsert(
                    { user_id: userId, key_id: id, key_data: JSON.parse(dataString) },
                    { onConflict: 'user_id,key_id' }
                );
        } catch (error) {
            console.error('[SupabaseAuthState] Error writing data:', error);
        }
    };

    const readData = async (id: string) => {
        try {
            const { data, error } = await supabaseAdmin
                .from('whatsapp_sessions')
                .select('key_data')
                .eq('user_id', userId)
                .eq('key_id', id)
                .maybeSingle();

            if (error || !data) return null;
            return JSON.parse(JSON.stringify(data.key_data), BufferJSON.reviver);
        } catch (error) {
            console.error('[SupabaseAuthState] Error reading data:', error);
            return null;
        }
    };

    const removeData = async (id: string) => {
        try {
            await supabaseAdmin
                .from('whatsapp_sessions')
                .delete()
                .eq('user_id', userId)
                .eq('key_id', id);
        } catch (error) {
            console.error('[SupabaseAuthState] Error removing data:', error);
        }
    };

    let creds: AuthenticationCreds;
    const credsData = await readData('creds');
    if (credsData) {
        creds = credsData;
    } else {
        creds = initAuthCreds();
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type: keyof SignalDataTypeMap, ids: string[]) => {
                    const data: { [id: string]: any } = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = await import('@whiskeysockets/baileys').then((b) => b.proto.Message.AppStateSyncKeyData.fromObject(value));
                            }
                            data[id] = value;
                        })
                    );
                    return data as any;
                },
                set: async (data: any) => {
                    const tasks: Promise<void>[] = [];
                    for (const category of Object.keys(data)) {
                        for (const id of Object.keys(data[category])) {
                            const value = data[category][id];
                            const keyId = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(value, keyId));
                            } else {
                                tasks.push(removeData(keyId));
                            }
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: () => writeData(creds, 'creds'),
        clearAll: async () => {
            await supabaseAdmin?.from('whatsapp_sessions').delete().eq('user_id', userId);
        }
    };
};
