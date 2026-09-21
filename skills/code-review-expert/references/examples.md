# Worked Examples

Illustrative before/after for the most common findings. Load when a fix is not obvious. These are language-neutral in shape and written in C# to match the primary stack — they show **the transformation**, not a style the project must adopt. Project style is owned by the project's conventions and `.editorconfig`.

---

## 1. Long method → extract by step

```csharp
// BAD: one method, many reasons to change
void ProcessOrder(OrderId id)
{
    // fetch, validate, calculate pricing, update inventory,
    // create shipment, send notifications ... 200 lines
}

// GOOD: the top level reads as the sequence of steps
void ProcessOrder(OrderId id)
{
    var order = FetchOrder(id);
    Validate(order);
    var pricing = CalculatePricing(order);
    UpdateInventory(order);
    var shipment = CreateShipment(order);
    Notify(order, pricing, shipment);
}
```

Extract by **responsibility**, not by line count. Extracting a 5-line block that is only ever called here adds indirection without a boundary.

---

## 2. Nested conditionals → guard clauses

```csharp
// BAD: arrow code, the happy path is buried
if (order is not null)
{
    if (order.User is not null)
    {
        if (order.User.IsActive)
        {
            if (order.Total > 0)
            {
                return Process(order);
            }
            else return Error.InvalidTotal;
        }
        else return Error.Inactive;
    }
    else return Error.NoUser;
}
else return Error.NoOrder;

// GOOD: preconditions first, happy path last
if (order is null) return Error.NoOrder;
if (order.User is null) return Error.NoUser;
if (!order.User.IsActive) return Error.Inactive;
if (order.Total <= 0) return Error.InvalidTotal;
return Process(order);
```

---

## 3. Duplicated logic → one owner

```csharp
// BAD: the same rate table in two places; they will drift
decimal UserDiscount(User u) =>
    u.Membership == Membership.Gold ? u.Total * 0.2m :
    u.Membership == Membership.Silver ? u.Total * 0.1m : 0m;

decimal OrderDiscount(Order o) =>
    o.User.Membership == Membership.Gold ? o.Total * 0.2m :
    o.User.Membership == Membership.Silver ? o.Total * 0.1m : 0m;

// GOOD: one rule, two callers
static decimal Rate(Membership m) => m switch
{
    Membership.Gold => 0.2m,
    Membership.Silver => 0.1m,
    _ => 0m,
};

decimal UserDiscount(User u) => u.Total * Rate(u.Membership);
decimal OrderDiscount(Order o) => o.Total * Rate(o.User.Membership);
```

Duplicate code is only a finding when the copies encode the **same rule**. Two lookalikes that will diverge deliberately should stay separate.

---

## 4. Long parameter list → parameter object

```csharp
// BAD: positional, easy to transpose, hard to extend
void CreateUser(string email, string password, string name, int age, string city, string country, string phone) { }

// GOOD: a named shape with only the required fields
public sealed record NewUser(string Email, string Password, string Name, int? Age = null, string? Phone = null);

void CreateUser(NewUser user) { }
```

Only introduce the record when the clump repeats. A one-off 5-parameter on one call site is not a finding.

---

## 5. Magic values → named constants

```csharp
// BAD
if (user.Status == 2) { }
var discount = total * 0.15m;
await Task.Delay(86_400_000);

// GOOD
if (user.Status == UserStatus.Inactive) { }
var discount = total * DiscountRates.Premium;
await Task.Delay(TimeSpan.FromDays(1));
```

Prefer a domain construct (`TimeSpan`, an enum, a named record) over a bare constant when one exists.

---

## 6. Feature envy → move behaviour to the data's owner

```csharp
// BAD: Order reaches into User for every branch
class Order
{
    decimal Discount(User user) =>
        user.Membership == Membership.Gold ? Total * 0.2m :
        user.AccountAgeDays > 365 ? Total * 0.1m : 0m;
}

// GOOD: User answers for its own data; Order asks
class User
{
    decimal DiscountRate() =>
        Membership == Membership.Gold ? 0.2m :
        AccountAgeDays > 365 ? 0.1m : 0m;
}

class Order
{
    decimal Discount(User user) => Total * user.DiscountRate();
}
```

---

## 7. Silent failure → surface it at the boundary

```csharp
// BAD: nothing can tell that loading failed
try { Load(save); }
catch (Exception) { }

// GOOD: catch what you can act on, let the rest propagate
try
{
    Load(save);
}
catch (IOException ex)
{
    Log.Warn(ex, "save load failed; starting fresh", save.Path);
    StartFresh();
}
```

A catch that only logs and continues is still a silent failure unless the caller is *meant* to continue. If the caller cannot proceed, propagate.

---

## Using these

- Match the finding to the transformation, then confirm it is safe by the contract's `cheap` test before proposing it as `fix-now`.
- Do not present an example as a requirement. Cite the `rule` the finding violates; the example is only a suggested shape.
