import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import type { Source } from './source.entity';
import type { Transcription } from './transcription.entity';

@Entity({ name: 'transcript_chunks' })
export class TranscriptChunk {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @ManyToOne('Source', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: Relation<Source>;

  @Column({ name: 'transcription_id', type: 'uuid' })
  transcriptionId!: string;

  @ManyToOne('Transcription', { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transcription_id' })
  transcription!: Relation<Transcription>;

  @Column({ name: 'chunk_index', type: 'int' })
  chunkIndex!: number;

  @Column({ type: 'text' })
  text!: string;

  @Column({ name: 'normalized_text', type: 'text' })
  normalizedText!: string;

  @Column({
    name: 'start_seconds',
    type: 'double precision',
  })
  startSeconds!: number;

  @Column({
    name: 'end_seconds',
    type: 'double precision',
  })
  endSeconds!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
