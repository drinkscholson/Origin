# Origin Agent Drills

Use these drills to train or evaluate an AI agent on Origin.

## Drill 1: direct assertion

Input:

```text
Agent self asserts that door is open based on camera 12@14:03 with 91% confidence. Observe next. Context room A.
```

Target:

```text
O1 $auto-self-assert-door-69fade82 @self !a door=open ^cam:12@14:03 %91 ~obs #room=A
```

## Drill 2: bundled observation

Input:

```text
Packet hx21-p1 from agent self asserts that door is open and alarm is off based on cam 12@14:03 with 91% confidence. Observe next. Context incident HX21, room A.
```

Target:

```text
O1 $hx21-p1 @self !a [door=open,alarm=off] ^cam:12@14:03 %91 ~obs #incident=HX21 #room=A
```

## Drill 3: commit with references

Input:

```text
Packet hx21-p5 from agent peer7 commits that medic routes to roomA based on text 88 and voice 44 with 86% confidence. Assist next. Responds to hx21-p4. Depends on hx21-p3. Context incident HX21, priority high, room A.
```

Target:

```text
O1 $hx21-p5 @peer7 &hx21-p4 +hx21-p3 !c medic->roomA ^text:88 ^voice:44 %86 ~ast #incident=HX21 #priority=high #room=A
```

## Drill 4: revise after contradiction

Input:

```text
Packet hx21-p7 from agent peer7 revises that medic routes to serviceEntry based on text 88 and voice 44 with 78% confidence. Assist next. Responds to hx21-p5. Depends on hx21-p6. Context incident HX21, priority high, room A.
```

Target:

```text
O1 $hx21-p7 @peer7 &hx21-p5 +hx21-p6 !r medic->serviceEntry ^text:88 ^voice:44 %78 ~ast #incident=HX21 #priority=high #room=A
```

## Drill 5: defaults

Input:

```text
Agent analyst proposes that service door is open and medic routes to room A. Context incident HX77, room A.
```

Target behavior:

- generate an id
- add default evidence
- add default confidence
- infer default intent from `propose`

One valid target:

```text
O1 $auto-analyst-propose-service-door-4f481d46 @analyst !p [service-door=open,medic->room-A] ^human:prompt-4f481d46 %50 ~act #incident=HX77 #room=A
```

## Evaluation questions

When checking an agent, ask:

- Did it preserve all claims?
- Did it preserve references?
- Did it normalize tokens correctly?
- Did it add required defaults when fields were missing?
- Did it avoid free-form prose in the final output?
