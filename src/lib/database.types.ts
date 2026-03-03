import type { PlayerRole, PreferredSide } from "../domain/constants";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      players: {
        Row: {
          id: string
          user_id: string
          name: string
          email: string
          phone: string | null
          is_active: boolean
          role: PlayerRole
          team_id: string | null
          preferred_side: PreferredSide
          federation_points: number
          points_updated_at: string | null
          profile_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          email: string
          phone?: string | null
          is_active?: boolean
          role?: PlayerRole
          team_id?: string | null
          preferred_side?: PreferredSide
          federation_points?: number
          points_updated_at?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          email?: string
          phone?: string | null
          is_active?: boolean
          role?: PlayerRole
          team_id?: string | null
          preferred_side?: PreferredSide
          federation_points?: number
          points_updated_at?: string | null
          profile_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      games: {
        Row: {
          id: string
          round_number: number
          /** Data e hora do jogo (ISO string) */
          starts_at: string
          opponent: string
          location: string
          /** Liga: Qualificação|Regionais|Nacionais; outros: Torneio|Mix|Treino */
          phase: 'Qualificação' | 'Regionais' | 'Nacionais' | 'Torneio' | 'Mix' | 'Treino'
          status: 'agendado' | 'convocatoria_aberta' | 'convocatoria_fechada' | 'concluido' | 'open' | 'closed' | 'scheduled' | 'completed'
          team_id: string
          team_points: number | null
          no_show: boolean
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          round_number: number
          starts_at: string
          opponent: string
          location: string
          phase: 'Qualificação' | 'Regionais' | 'Nacionais' | 'Torneio' | 'Mix' | 'Treino'
          status?: 'agendado' | 'convocatoria_aberta' | 'convocatoria_fechada' | 'concluido' | 'open' | 'closed' | 'scheduled' | 'completed'
          team_id: string
          team_points?: number | null
          no_show?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          round_number?: number
          starts_at?: string
          opponent?: string
          location?: string
          phase?: 'Qualificação' | 'Regionais' | 'Nacionais' | 'Torneio' | 'Mix' | 'Treino'
          status?: 'agendado' | 'convocatoria_aberta' | 'convocatoria_fechada' | 'concluido' | 'open' | 'closed' | 'scheduled' | 'completed'
          team_id?: string
          team_points?: number | null
          no_show?: boolean
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      availabilities: {
        Row: {
          id: string
          game_id: string
          player_id: string
          status: 'confirmed' | 'declined' | 'undecided' | 'sem_resposta' | 'confirmo' | 'nao_posso' | 'talvez'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_id: string
          status?: 'confirmed' | 'declined' | 'undecided' | 'sem_resposta' | 'confirmo' | 'nao_posso' | 'talvez'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string
          status?: 'confirmed' | 'declined' | 'undecided' | 'sem_resposta' | 'confirmo' | 'nao_posso' | 'talvez'
          created_at?: string
          updated_at?: string
        }
      }
      pairs: {
        Row: {
          id: string
          game_id: string
          player1_id: string
          player2_id: string
          total_points: number
          pair_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player1_id: string
          player2_id: string
          total_points?: number
          pair_order: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player1_id?: string
          player2_id?: string
          total_points?: number
          pair_order?: number
          created_at?: string
          updated_at?: string
        }
      }
      results: {
        Row: {
          id: string
          game_id: string
          pair_id: string
          created_by: string
          set1_casa: number | null
          set1_fora: number | null
          set2_casa: number | null
          set2_fora: number | null
          set3_casa: number | null
          set3_fora: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          pair_id: string
          created_by: string
          set1_casa?: number | null
          set1_fora?: number | null
          set2_casa?: number | null
          set2_fora?: number | null
          set3_casa?: number | null
          set3_fora?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          pair_id?: string
          created_by?: string
          set1_casa?: number | null
          set1_fora?: number | null
          set2_casa?: number | null
          set2_fora?: number | null
          set3_casa?: number | null
          set3_fora?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
  }
}

// Helper types
export type Team = Database['public']['Tables']['teams']['Row']
export type Player = Database['public']['Tables']['players']['Row']
export type Game = Database['public']['Tables']['games']['Row']
export type Availability = Database['public']['Tables']['availabilities']['Row']
export type Pair = Database['public']['Tables']['pairs']['Row']
export type Result = Database['public']['Tables']['results']['Row']

export type GameStatus = Game['status']
export type AvailabilityStatus = Availability['status']
export type PlayerRole = Player['role']
