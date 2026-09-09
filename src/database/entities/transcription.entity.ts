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
import { TranscriptionStatus } from '../enums';
import type { Source } from './source.entity';

@Entity({ name: 'transcriptions' })
export class Transcription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @ManyToOne('Source', (source: Source) => source.transcriptions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_id' })
  source!: Relation<Source>;

  @Column({ type: 'varchar', length: 64 })
  provider!: string;

  @Column({
    type: 'enum',
    enum: TranscriptionStatus,
    enumName: 'transcription_status',
    default: TranscriptionStatus.PENDING,
  })
  status!: TranscriptionStatus;

  @Column({ type: 'varchar', length: 32, nullable: true })
  language!: string | null;

  @Column({ name: 'full_text', type: 'text', nullable: true })
  fullText!: string | null;

  @Column({ name: 'segments_json', type: 'jsonb', nullable: true })
  segmentsJson!: Array<{
    startSeconds: number;
    endSeconds: number;
    text: string;
  }> | null;

  @Column({ name: 'raw_path', type: 'varchar', length: 1024, nullable: true })
  rawPath!: string | null;

  @Column({
    name: 'structured_path',
    type: 'varchar',
    length: 1024,
    nullable: true,
  })
  structuredPath!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'int', default: 1 })
  attempt!: number;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
