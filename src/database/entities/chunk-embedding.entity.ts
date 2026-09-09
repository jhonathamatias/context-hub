import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Source } from './source.entity';
import { TranscriptChunk } from './transcript-chunk.entity';
import { Transcription } from './transcription.entity';

@Entity({ name: 'chunk_embeddings' })
@Unique('UQ_chunk_embeddings_chunk_model', ['chunkId', 'model'])
export class ChunkEmbedding {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'chunk_id', type: 'uuid' })
  chunkId!: string;

  @ManyToOne(() => TranscriptChunk, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chunk_id' })
  chunk!: TranscriptChunk;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @ManyToOne(() => Source, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source!: Source;

  @Column({ name: 'transcription_id', type: 'uuid' })
  transcriptionId!: string;

  @ManyToOne(() => Transcription, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transcription_id' })
  transcription!: Transcription;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @Column({ type: 'varchar', length: 128 })
  model!: string;

  @Column({ type: 'int' })
  dimension!: number;

  @Column({ name: 'content_hash', type: 'varchar', length: 64 })
  contentHash!: string;

  @Column({ name: 'values', type: 'jsonb' })
  values!: number[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
