export function reviewKeyframes(count: number): Keyframe[] {
  const frames: Keyframe[] = [{ transform: 'translateX(0%)', offset: 0 }];
  for (let index = 0; index < count; index++) {
    frames.push(
      { transform: `translateX(${-50 * index / count}%)`, offset: (index + 0.75) / count },
      { transform: `translateX(${-50 * (index + 1) / count}%)`, offset: (index + 1) / count },
    );
  }
  return frames;
}
