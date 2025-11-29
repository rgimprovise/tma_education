import { Module } from '@nestjs/common';
import { CourseService } from './course.service';
import { CoursesService } from './courses.service';
import { CourseAdminService } from './course-admin.service';
import { CourseController } from './course.controller';
import { CourseAdminController } from './admin.controller';
import { CourseBuilderController } from './course-builder.controller';
import { CourseCoursesController } from './course-courses.controller';
import { AuthModule } from '../auth/auth.module';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [AuthModule, TelegramModule],
  controllers: [
    CourseController,
    CourseAdminController,
    CourseBuilderController,
    CourseCoursesController,
  ],
  providers: [CourseService, CoursesService, CourseAdminService],
  exports: [CourseService, CoursesService, CourseAdminService],
})
export class CourseModule {}

