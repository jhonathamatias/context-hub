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
import { ProcessingJobStatus, ProcessingStage } from '../enums';
import type { Source } from './source.entity';

@Entity({ name: 'processing_jobs' })
export class ProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'source_id', type: 'uuid' })
  sourceId!: string;

  @ManyToOne('Source', (source: Source) => source.processingJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'source_id' })
  source!: Relation<Source>;

  @Column({
    type: 'enum',
    enum: ProcessingStage,
    enumName: 'processing_stage',
  })
  stage!: ProcessingStage;

  @Column({
    type: 'enum',
    enum: ProcessingJobStatus,
    enumName: 'processing_job_status',
    default: ProcessingJobStatus.PENDING,
  })
  status!: ProcessingJobStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
