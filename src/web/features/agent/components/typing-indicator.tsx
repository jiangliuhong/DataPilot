/** "正在输入"动画指示器 */
export default function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-1 py-1" aria-label="正在输入">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-default-400 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}
