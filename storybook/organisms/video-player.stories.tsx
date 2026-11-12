import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { VideoPlayer } from '@/features/classroom/video-player';

const meta = {
  title: 'Organisms/VideoPlayer', component: VideoPlayer,
  args: { lessonId: 'lesson-1', previewUrl: 'https://player.vimeo.com/video/1' },
} satisfies Meta<typeof VideoPlayer>;
export default meta;
export const Preview: StoryObj<typeof meta> = {};
