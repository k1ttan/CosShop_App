-- 016_performance_indexes_and_atomic_booking.sql
-- Optimizing query performance, composite indexes, and atomic booking verification

-- 1. Index for faster public schedule lookup and double-booking checks
CREATE INDEX IF NOT EXISTS idx_bookings_costume_schedule 
ON public.bookings (costume_id, start_date, end_date, status);

-- 2. Index for user bookings list
CREATE INDEX IF NOT EXISTS idx_bookings_user_created 
ON public.bookings (user_id, created_at DESC);

-- 3. Index for chat messages retrieval order
CREATE INDEX IF NOT EXISTS idx_chat_messages_conv_created 
ON public.chat_messages (conversation_id, created_at ASC);

-- 4. Index for active conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversations_user_status 
ON public.conversations (user_id, status);

-- 5. Atomic Double-Booking Validator Function
CREATE OR REPLACE FUNCTION public.check_booking_availability(
    p_costume_id UUID,
    p_start_date DATE,
    p_end_date DATE,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_quantity INT;
    v_buffer_days INT;
    v_overlapping_count INT;
    v_search_start DATE;
    v_search_end DATE;
BEGIN
    -- Fetch costume info with row locking to prevent concurrent race condition
    SELECT quantity, COALESCE(buffer_days, 3)
    INTO v_quantity, v_buffer_days
    FROM public.costumes
    WHERE id = p_costume_id
    FOR SHARE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- If quantity is 1 (or single item remaining), consider buffer days
    IF v_quantity <= 1 THEN
        v_search_start := p_start_date - (v_buffer_days || ' days')::INTERVAL;
        v_search_end   := p_end_date + (v_buffer_days || ' days')::INTERVAL;
    ELSE
        v_search_start := p_start_date;
        v_search_end   := p_end_date;
    END IF;

    -- Count active overlapping bookings
    SELECT COUNT(*)
    INTO v_overlapping_count
    FROM public.bookings
    WHERE costume_id = p_costume_id
      AND status IN ('confirmed', 'shipping', 'renting', 'overdue')
      AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
      AND (
          (start_date <= v_search_end AND end_date >= v_search_start)
      );

    -- Available if overlapping count is less than inventory quantity
    RETURN v_overlapping_count < v_quantity;
END;
$$;
