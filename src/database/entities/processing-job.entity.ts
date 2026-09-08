import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProcessingJobStatus, ProcessingStage } from '../enums';
import { Source } from './source.entity';

@Entity({ name: 'processing_jobs' })
export class ProcessingJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  sourceId!: string;

  @ManyToOne(() => Source, (source) => source.processingJobs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'sourceId' })
  source!: Source;

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

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  startedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
