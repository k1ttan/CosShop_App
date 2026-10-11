-- =============================================================
-- MIGRATION 015: Hộp Chat Thời Gian Thực (Realtime Chat System)
-- Hỗ trợ Bong bóng chat nổi, Đính kèm Ngữ cảnh, Quote Reply,
-- Nén ảnh WebP và Lưu trữ (Archive) cuộc trò chuyện
-- =============================================================

-- 1. Tạo bảng conversations (Quản lý phiên hội thoại giữa User và Admin)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_preview TEXT,
  user_unread_count INT NOT NULL DEFAULT 0,
  admin_unread_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tối ưu truy vấn danh sách hội thoại
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations (user_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at ON public.conversations (last_message_at DESC);

-- 2. Tạo bảng chat_messages (Quản lý từng tin nhắn trong cuộc trò chuyện)
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('user', 'admin')),
  content TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  context_type TEXT CHECK (context_type IN ('costume', 'booking', NULL)),
  context_id UUID,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tối ưu lấy tin nhắn theo thứ tự thời gian
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created ON public.chat_messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON public.chat_messages (reply_to_id);

-- 3. Cấu hình Row Level Security (RLS)

-- 3.1. RLS cho bảng conversations
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conversations_user_select"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "conversations_user_insert"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_user_update"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "conversations_admin_all"
  ON public.conversations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- 3.2. RLS cho bảng chat_messages
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_user_select"
  ON public.chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "chat_messages_user_insert"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_role = 'user' AND
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid() AND c.status = 'active'
    )
  );

CREATE POLICY "chat_messages_admin_all"
  ON public.chat_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- 4. Tạo Storage Bucket "chat-attachments" lưu hình ảnh đính kèm
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy Storage: Public có thể xem hình ảnh chat
CREATE POLICY "chat_attachments_public_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

-- Policy Storage: Authenticated user hoặc Admin có thể upload
CREATE POLICY "chat_attachments_auth_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.role() = 'authenticated');

-- 5. Kích hoạt Supabase Realtime Publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Bỏ qua nếu môi trường không hỗ trợ publication trực tiếp
END $$;

-- 6. Function & Trigger: Tự động cập nhật conversations & thông báo khi có tin nhắn mới
CREATE OR REPLACE FUNCTION public.handle_new_chat_message()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_preview TEXT;
BEGIN
  -- Lấy thông tin user_id của cuộc hội thoại
  SELECT user_id INTO v_user_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Xác định đoạn trích tin nhắn
  IF NEW.content IS NOT NULL AND TRIM(NEW.content) <> '' THEN
    v_preview := SUBSTRING(NEW.content, 1, 100);
  ELSIF array_length(NEW.image_urls, 1) > 0 THEN
    v_preview := '📷 [Hình ảnh]';
  ELSE
    v_preview := 'Tin nhắn mới';
  END IF;

  -- Cập nhật thông tin hội thoại
  IF NEW.sender_role = 'admin' THEN
    UPDATE public.conversations
    SET 
      last_message_at = NEW.created_at,
      last_message_preview = v_preview,
      user_unread_count = user_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;

    -- Tự động gửi thông báo In-App vào bảng notifications cho khách hàng
    IF v_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        user_id,
        title,
        message,
        type,
        link,
        is_read,
        created_at
      ) VALUES (
        v_user_id,
        '🌸 Tin nhắn mới từ Shop CosRent',
        v_preview,
        'chat',
        '#chat',
        FALSE,
        NOW()
      );
    END IF;
  ELSE
    UPDATE public.conversations
    SET 
      last_message_at = NEW.created_at,
      last_message_preview = v_preview,
      admin_unread_count = admin_unread_count + 1,
      updated_at = NOW()
    WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_chat_message_insert ON public.chat_messages;
CREATE TRIGGER trg_chat_message_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_chat_message();
