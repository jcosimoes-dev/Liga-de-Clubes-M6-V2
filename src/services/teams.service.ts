import { supabase } from '../lib/supabase';
import type { Team } from '../lib/database.types';

export const TeamsService = {
  /**
   * Obter todas as equipas (apenas admins vêem todas)
   */
  async getAll() {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Obter equipas activas
   */
  async getActive() {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return data;
  },

  /**
   * Obter equipa por ID
   */
  async getById(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  /**
   * Criar nova equipa (apenas admins)
   */
  async create(team: {
    name: string;
    description?: string;
  }) {
    const { data, error } = await supabase
      .from('teams')
      .insert({
        ...team,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Actualizar equipa (apenas admins)
   */
  async update(id: string, updates: Partial<Team>) {
    const { data, error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Desactivar equipa (apenas admins)
   */
  async deactivate(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Activar equipa (apenas admins)
   */
  async activate(id: string) {
    const { data, error } = await supabase
      .from('teams')
      .update({ is_active: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Eliminar equipa (apenas admins)
   */
  async delete(id: string) {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};
